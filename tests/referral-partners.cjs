const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const partners = []
const ordersByPartner = new Map()

function pick(row) {
  return { id: row.id, name: row.name, code: row.code, active: row.active, commission_percent: row.commission_percent }
}

const pool = {
  async query(sql, params = []) {
    if (sql.includes('INSERT INTO referral_partners')) {
      const [name, code, accessToken] = params
      if (partners.some((p) => p.code === code || p.access_token === accessToken)) {
        const error = new Error('duplicate key')
        error.code = '23505'
        throw error
      }
      const row = {
        id: `aaaaaaaa-0000-4000-8000-00000000000${partners.length + 1}`,
        name,
        code,
        access_token: accessToken,
        commission_percent: 10,
        active: true,
        created_at: new Date(),
      }
      partners.push(row)
      return { rows: [row] }
    }
    if (sql.includes('FROM referral_partners WHERE code = $1 AND active = true')) {
      const row = partners.find((p) => p.code === params[0] && p.active)
      return { rows: row ? [{ id: row.id, code: row.code }] : [] }
    }
    if (sql.includes('FROM referral_partners WHERE id = $1 AND active = true')) {
      const row = partners.find((p) => p.id === params[0] && p.active)
      return { rows: row ? [{ id: row.id }] : [] }
    }
    if (sql.includes('FROM referral_partners ORDER BY created_at DESC')) {
      return { rows: partners.map(pick) }
    }
    if (sql.includes('FROM referral_partners WHERE id = $1')) {
      const row = partners.find((p) => p.id === params[0])
      return { rows: row ? [pick(row)] : [] }
    }
    if (sql.includes('FROM referral_partners WHERE access_token = $1')) {
      const row = partners.find((p) => p.access_token === params[0])
      return { rows: row ? [pick(row)] : [] }
    }
    if (sql.includes('FROM orders o') && sql.includes('LEFT JOIN cleanings')) {
      const rows = (ordersByPartner.get(params[0]) ?? [])
        .slice()
        .sort((a, b) => b.created_at - a.created_at)
      return { rows }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  },
}

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === '@/lib/db/postgres') return { getPostgresPool: () => pool }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename)
}

const referralPartners = require('../lib/data/referral-partners.ts')

function addOrder(partnerId, order) {
  const list = ordersByPartner.get(partnerId) ?? []
  list.push({ created_at: new Date(), ...order })
  ordersByPartner.set(partnerId, list)
}

async function main() {
  // computeCommission: 10% rounded, order #7/#8 math
  assert.equal(referralPartners.computeCommission(1000, 10), 100)
  assert.equal(referralPartners.computeCommission(1050, 10), 105)
  assert.equal(referralPartners.computeCommission(995, 10), 100)
  assert.equal(referralPartners.computeCommission(1000, 15), 150)

  // #9 admin can create referral partners: unique code + a long random base64url access token
  const client = { query: (...args) => pool.query(...args) }
  const partnerA = await referralPartners.createReferralPartner(client, '  ООО Ромашка  ')
  assert.equal(partnerA.name, 'ООО Ромашка')
  assert.match(partnerA.code, /^[A-Za-z0-9]{4,16}$/)
  assert.match(partnerA.accessToken, /^[A-Za-z0-9_-]{32}$/)
  assert.equal(partnerA.active, true)
  assert.equal(partnerA.commissionPercent, 10)

  const partnerB = await referralPartners.createReferralPartner(client, 'Второй партнёр')
  assert.notEqual(partnerA.code, partnerB.code)
  assert.notEqual(partnerA.accessToken, partnerB.accessToken)

  // #2 invalid/unknown/disabled code never resolves
  assert.equal(await referralPartners.getActiveReferralPartnerByCode('nope'), null)
  assert.equal(await referralPartners.getActiveReferralPartnerByCode('!!!!'), null)
  const resolved = await referralPartners.getActiveReferralPartnerByCode(partnerA.code)
  assert.equal(resolved.id, partnerA.id)
  const disabled = partners.find((p) => p.id === partnerB.id)
  disabled.active = false
  assert.equal(await referralPartners.getActiveReferralPartnerByCode(partnerB.code), null)
  assert.equal(await referralPartners.getActiveReferralPartnerId(client, partnerB.id), null)
  disabled.active = true

  // #7/#8: a completed order (cleaning completed/accepted) counts toward commission,
  // an incomplete one (in_progress, or no cleaning yet) does not.
  addOrder(partnerA.id, { id: 'o1', number: 'CT-000001', total_price: 1000, order_status: 'confirmed', cleaning_status: 'completed' })
  addOrder(partnerA.id, { id: 'o2', number: 'CT-000002', total_price: 2000, order_status: 'confirmed', cleaning_status: 'in_progress' })
  addOrder(partnerA.id, { id: 'o3', number: 'CT-000003', total_price: 500, order_status: 'new', cleaning_status: null })
  addOrder(partnerA.id, { id: 'o4', number: 'CT-000004', total_price: 3000, order_status: 'confirmed', cleaning_status: 'accepted' })
  // #5: a different partner's orders must never leak into partner A's stats.
  addOrder(partnerB.id, { id: 'o5', number: 'CT-000005', total_price: 999999, order_status: 'confirmed', cleaning_status: 'completed' })

  const detail = await referralPartners.getReferralPartnerByAccessToken(partnerA.accessToken)
  assert.equal(detail.ordersCount, 4)
  assert.equal(detail.totalAmount, 1000 + 2000 + 500 + 3000)
  assert.equal(detail.completedAmount, 1000 + 3000)
  assert.equal(detail.accruedCommission, 100 + 300)
  assert.deepEqual(detail.orders.map((o) => o.number).sort(), ['CT-000001', 'CT-000002', 'CT-000003', 'CT-000004'])

  const byStatus = Object.fromEntries(detail.orders.map((o) => [o.number, o]))
  assert.equal(byStatus['CT-000001'].statusLabel, 'Выполнен')
  assert.equal(byStatus['CT-000001'].completed, true)
  assert.equal(byStatus['CT-000002'].statusLabel, 'В работе')
  assert.equal(byStatus['CT-000002'].completed, false)
  assert.equal(byStatus['CT-000003'].statusLabel, 'Новый')
  assert.equal(byStatus['CT-000004'].statusLabel, 'Выполнен')

  // #6: partner output never carries client PII fields.
  const forbidden = ['clientName', 'clientPhone', 'address', 'telegramUsername', 'client_name', 'client_phone']
  const detailKeys = Object.keys(detail)
  const orderKeys = detail.orders.length ? Object.keys(detail.orders[0]) : []
  for (const field of forbidden) {
    assert.ok(!detailKeys.includes(field), `partner detail leaked ${field}`)
    assert.ok(!orderKeys.includes(field), `order summary leaked ${field}`)
  }
  assert.ok(!('accessToken' in detail), 'partner detail must never echo its own access token')

  // #12: an invalid or unknown token resolves to null (the page turns this into 404).
  assert.equal(await referralPartners.getReferralPartnerByAccessToken('too-short'), null)
  assert.equal(await referralPartners.getReferralPartnerByAccessToken('a'.repeat(32)), null)

  const listed = await referralPartners.listReferralPartnersWithStats()
  const listedA = listed.find((p) => p.id === partnerA.id)
  assert.equal(listedA.ordersCount, 4)
  assert.equal(listedA.accruedCommission, 400)

  console.log('PASS: referral commission math, code/token generation, partner isolation and PII-free output')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
