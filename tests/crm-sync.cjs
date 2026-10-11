const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename)
}

const { buildCrmLeadPayload } = require('../lib/crm-lead-payload.ts')
const crmSync = require('../lib/server/crm-sync.ts')

const order = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  number: 'CT-000123',
  clientName: 'Анна',
  clientPhone: '+79990000000',
  rooms: 2,
  windowsCount: 2,
  ironingHours: 0,
  balcony: true,
  generalCleaning: false,
  otherRequest: null,
  totalPrice: 7100,
}

async function main() {
  // Correct CRM payload for a new order.
  const payload = buildCrmLeadPayload(order)
  assert.equal(payload.project, 'cleantrack')
  assert.equal(payload.name, 'Анна')
  assert.equal(payload.phone, '+79990000000')
  assert.equal(payload.source, 'Telegram')
  assert.equal(payload.service, 'Уборка квартиры')
  assert.equal(payload.lead_tracking_id, order.id)
  assert.match(payload.message, /Заказ CleanTrack: CT-000123/)
  assert.match(payload.message, /2 комнаты/)
  assert.match(payload.message, /Окна: 2/)
  assert.match(payload.message, /Балкон \/ лоджия/)
  assert.doesNotMatch(payload.message, /Глажка/)
  assert.doesNotMatch(payload.message, /Генеральная уборка/)
  assert.match(payload.message, /Предварительная стоимость: 7 100 ₽/)

  // Empty fields never leak into the message.
  const minimal = buildCrmLeadPayload({ ...order, windowsCount: 0, balcony: false, otherRequest: null })
  assert.doesNotMatch(minimal.message, /Окна/)
  assert.doesNotMatch(minimal.message, /Балкон/)
  assert.doesNotMatch(minimal.message, /Дополнительно/)

  // Idempotency: the same order always builds the same lead_tracking_id (the CRM's own
  // ON CONFLICT on lead_tracking_id is what actually blocks a duplicate lead/notification —
  // already covered by olnoo-admin's own tests — this only proves the stable key going in).
  assert.equal(buildCrmLeadPayload(order).lead_tracking_id, buildCrmLeadPayload(order).lead_tracking_id)
  const otherOrder = { ...order, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
  assert.notEqual(buildCrmLeadPayload(order).lead_tracking_id, buildCrmLeadPayload(otherOrder).lead_tracking_id)

  // Without OLNOO_CRM_URL/OLNOO_CRM_API_KEY configured, syncOrderToCrm must resolve quietly
  // (never throw) — a CleanTrack order must always save regardless of CRM configuration.
  const savedUrl = process.env.OLNOO_CRM_URL
  const savedKey = process.env.OLNOO_CRM_API_KEY
  delete process.env.OLNOO_CRM_URL
  delete process.env.OLNOO_CRM_API_KEY
  await assert.doesNotReject(() => crmSync.syncOrderToCrm(order))
  if (savedUrl === undefined) delete process.env.OLNOO_CRM_URL; else process.env.OLNOO_CRM_URL = savedUrl
  if (savedKey === undefined) delete process.env.OLNOO_CRM_API_KEY; else process.env.OLNOO_CRM_API_KEY = savedKey

  // telegram-order-bot.ts actually wires the sync in on order:submit, after the order is saved.
  const botSource = fs.readFileSync(path.join(__dirname, '../lib/server/telegram-order-bot.ts'), 'utf8')
  assert.match(botSource, /syncOrderToCrm\(result\)/)

  console.log('PASS: CRM lead payload, idempotent tracking id, missing-env safety, order:submit wiring')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
