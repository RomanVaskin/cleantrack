const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const PARTNER_VALID_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const PARTNER_DISABLED_ID = 'bbbbbbbb-0000-4000-8000-000000000002'
const NEW_PARTNER_ID = 'cccccccc-0000-4000-8000-000000000003'

const sessions = new Map()
const sent = []
const answeredCallbacks = []
const insertedOrders = []
const createdPartners = []
const activeCodeLookups = []
const activeIdLookups = []

const client = {
  async query(sql, params = []) {
    if (sql.includes('SELECT state, data FROM telegram_sessions')) {
      const session = sessions.get(params[0])
      return { rows: session ? [structuredClone(session)] : [] }
    }
    if (sql.includes('INSERT INTO telegram_sessions')) {
      sessions.set(params[0], { state: params[1], data: JSON.parse(params[2]) })
      return { rows: [] }
    }
    if (sql.includes('DELETE FROM telegram_sessions')) {
      sessions.delete(params[0])
      return { rows: [] }
    }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('next_number')) return { rows: [{ next_number: String(insertedOrders.length + 1) }] }
    if (sql.includes('INSERT INTO orders')) {
      insertedOrders.push(params)
      return { rows: [{ id: `order-${insertedOrders.length}` }] }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  },
}
const pool = { query: (...args) => client.query(...args) }

const referralPartnersMock = {
  createReferralPartner: async (_client, name) => {
    const partner = {
      id: NEW_PARTNER_ID,
      name: name.trim(),
      code: 'CODE1',
      accessToken: `token-1-${'a'.repeat(26)}`,
      commissionPercent: 10,
      active: true,
      createdAt: new Date().toISOString(),
    }
    createdPartners.push(partner)
    return partner
  },
  getActiveReferralPartnerByCode: async (code) => {
    activeCodeLookups.push(code)
    return code === 'VALID1' ? { id: PARTNER_VALID_ID, code: 'VALID1' } : null
  },
  getActiveReferralPartnerId: async (_client, id) => {
    activeIdLookups.push(id)
    return id === PARTNER_VALID_ID ? id : null
  },
  listReferralPartnersWithStats: async () => [
    {
      id: PARTNER_VALID_ID, name: 'Иван', code: 'VALID1', active: true, commissionPercent: 10,
      ordersCount: 2, totalAmount: 3000, completedAmount: 1000, accruedCommission: 100,
    },
  ],
  getReferralPartnerAdminDetailById: async (id) => (id === PARTNER_VALID_ID
    ? {
        id: PARTNER_VALID_ID, name: 'Иван', code: 'VALID1', active: true, commissionPercent: 10,
        accessToken: `token-valid-${'a'.repeat(19)}`,
        ordersCount: 1, totalAmount: 1000, completedAmount: 1000, accruedCommission: 100,
        orders: [{ id: 'o1', number: 'CT-000001', createdAt: new Date().toISOString(), totalPrice: 1000, statusLabel: 'Выполнен', completed: true, commission: 100 }],
      }
    : null),
}

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === '@/lib/db/postgres') {
    return { getPostgresPool: () => pool, withTransaction: async (_pool, work) => work(client) }
  }
  if (id === '@/lib/data/telegram-orders') {
    return {
      confirmTelegramOrder: async () => ({ kind: 'error' }),
      rejectTelegramOrder: async () => ({ kind: 'error' }),
    }
  }
  if (id === '@/lib/data/referral-partners') return referralPartnersMock
  if (id === '@/lib/home-content') return { TELEGRAM_CONTACT_URL: 'https://t.me/CleanTrackRuBot' }
  if (id === '@/lib/server/telegram-api') {
    return {
      sendMessage: async (chatId, text, markup) => { sent.push({ chatId, text, markup }) },
      answerCallbackQuery: async (callbackId, text) => { answeredCallbacks.push({ callbackId, text }) },
      editMessageText: async () => {},
      editMessageReplyMarkup: async () => {},
    }
  }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename)
}

const bot = require('../lib/server/telegram-order-bot.ts')

const message = (chatId, text) => bot.handleTelegramUpdate({ message: { message_id: 1, chat: { id: chatId }, text } })
const callback = (chatId, data) => bot.handleTelegramUpdate({
  callback_query: { id: `cb-${chatId}-${data}`, data, from: { username: 'u' }, message: { message_id: 2, chat: { id: chatId } } },
})
const seed = (chatId, state, data) => sessions.set(chatId, { state, data: structuredClone(data) })

const readyOrderData = {
  rooms: 2,
  photoReportEnabled: true,
  clientName: 'Анна',
  clientPhone: '+79990000000',
  address: 'Москва',
  requestedDate: '2099-09-25',
  requestedTime: '09:00–12:00',
  cabinetsRule: 'none',
  personalItemsRule: 'none',
  doNotTouch: '',
}

async function main() {
  process.env.TELEGRAM_ADMIN_CHAT_IDS = '999'
  delete process.env.TELEGRAM_ADMIN_CHAT_ID

  // #1 valid /start ref_CODE saves referral attribution, which survives into the session
  const refChat = 501
  await message(refChat, '/start ref_VALID1')
  assert.deepEqual(activeCodeLookups.at(-1), 'VALID1')
  const refKeyboard = sent.at(-1).markup
  const refCallbackData = refKeyboard.inline_keyboard[0][0].callback_data
  assert.equal(refCallbackData, `order:start:ref:${PARTNER_VALID_ID}`)

  await callback(refChat, refCallbackData)
  assert.equal(sessions.get(refChat).data.referralPartnerId, PARTNER_VALID_ID)

  // #2 an invalid/unknown referral code never attaches a partner; /start behaves as plain /start
  const badChat = 502
  await message(badChat, '/start ref_UNKNOWN')
  assert.deepEqual(activeCodeLookups.at(-1), 'UNKNOWN')
  const plainKeyboard = sent.at(-1).markup
  assert.equal(plainKeyboard.inline_keyboard[0][0].callback_data, 'order:start')
  await callback(badChat, 'order:start')
  assert.equal(sessions.get(badChat).data.referralPartnerId, undefined)

  // #4 a plain /start with no payload works exactly as before
  const plainChat = 503
  await message(plainChat, '/start')
  assert.equal(activeCodeLookups.includes(undefined), false)
  await callback(plainChat, 'order:start')
  assert.deepEqual(sessions.get(plainChat).data, {})

  // #3 a referred order is inserted with referral_partner_id + referral_source
  seed(refChat, 'awaiting_confirmation', { ...readyOrderData, referralPartnerId: PARTNER_VALID_ID })
  await callback(refChat, 'order:submit')
  const referredInsert = insertedOrders.at(-1)
  assert.equal(referredInsert[21], PARTNER_VALID_ID)
  assert.equal(referredInsert[22], 'telegram')
  assert.deepEqual(activeIdLookups.at(-1), PARTNER_VALID_ID)

  // #4 an order with no referral keeps both columns null, exactly like before this feature
  seed(plainChat, 'awaiting_confirmation', { ...readyOrderData })
  await callback(plainChat, 'order:submit')
  const plainInsert = insertedOrders.at(-1)
  assert.equal(plainInsert[21], null)
  assert.equal(plainInsert[22], null)

  // A partner disabled between /start and submission must not be attributed either.
  seed(badChat, 'awaiting_confirmation', { ...readyOrderData, referralPartnerId: PARTNER_DISABLED_ID })
  await callback(badChat, 'order:submit')
  const disabledInsert = insertedOrders.at(-1)
  assert.equal(disabledInsert[21], null)
  assert.equal(disabledInsert[22], null)

  // #9 admin can create and list referral partners
  const adminChat = 999
  await message(adminChat, '/referrals')
  assert.match(sent.at(-1).text, /Рефералы/)
  const menu = sent.at(-1).markup
  assert.equal(menu.inline_keyboard[0][0].callback_data, 'refadmin:list')
  assert.equal(menu.inline_keyboard[1][0].callback_data, 'refadmin:new')

  await callback(adminChat, 'refadmin:new')
  assert.equal(sessions.get(adminChat).state, 'admin_awaiting_referral_name')

  await message(adminChat, 'Иван Петров')
  assert.equal(createdPartners.at(-1).name, 'Иван Петров')
  const createdText = sent.at(-1).text
  assert.match(createdText, /Партнёр: Иван Петров/)
  assert.match(createdText, /start=ref_CODE1/)
  assert.match(createdText, /\/r\/CODE1/)
  assert.match(createdText, /\/partner\/token-1-/)
  assert.equal(sessions.has(adminChat), false)

  await callback(adminChat, 'refadmin:list')
  assert.match(sent.at(-1).text, /Иван/)

  // Opening an existing partner re-shows all three client/partner links, not just stats —
  // this is the usability fix: previously only partner creation ever showed them.
  await callback(adminChat, `refadmin:open:${PARTNER_VALID_ID}`)
  const openText = sent.at(-1).text
  assert.match(openText, /Партнёр: Иван/)
  assert.match(openText, /Комиссия с выполненных: 100/)
  assert.match(openText, /start=ref_VALID1/)
  assert.match(openText, /\/r\/VALID1/)
  assert.match(openText, /\/partner\/token-valid-/)

  // #10 a non-admin chat cannot reach any referral admin action, including re-opening a
  // partner to read its access token / partner URL.
  const strangerChat = 12345
  const sentBefore = sent.length
  await message(strangerChat, '/referrals')
  assert.equal(sent.length, sentBefore)

  await callback(strangerChat, 'refadmin:list')
  assert.equal(sent.length, sentBefore)
  assert.equal(answeredCallbacks.at(-1).text, 'Недоступно.')

  await callback(strangerChat, 'refadmin:new')
  assert.equal(sent.length, sentBefore)
  assert.equal(answeredCallbacks.at(-1).text, 'Недоступно.')

  await callback(strangerChat, `refadmin:open:${PARTNER_VALID_ID}`)
  assert.equal(sent.length, sentBefore)
  assert.equal(answeredCallbacks.at(-1).text, 'Недоступно.')

  // Regression test for the room-selection bug: `room:*` used to rebuild session.data from
  // scratch ({ rooms }), silently dropping referralPartnerId. This drives the REAL callback/
  // message sequence end to end instead of hand-seeding "awaiting_confirmation" directly,
  // because that shortcut is exactly what let the bug slip past the other tests above.
  const fullFlowChat = 601
  await message(fullFlowChat, '/start ref_VALID1')
  const fullFlowStartCb = sent.at(-1).markup.inline_keyboard[0][0].callback_data
  assert.equal(fullFlowStartCb, `order:start:ref:${PARTNER_VALID_ID}`)

  await callback(fullFlowChat, fullFlowStartCb)
  assert.equal(sessions.get(fullFlowChat).state, 'choosing_rooms')
  assert.equal(sessions.get(fullFlowChat).data.referralPartnerId, PARTNER_VALID_ID)

  await callback(fullFlowChat, 'room:2')
  assert.equal(sessions.get(fullFlowChat).state, 'choosing_extras')
  assert.equal(sessions.get(fullFlowChat).data.referralPartnerId, PARTNER_VALID_ID)

  await callback(fullFlowChat, 'extra:done')
  assert.equal(sessions.get(fullFlowChat).state, 'awaiting_photo_report')
  assert.equal(sessions.get(fullFlowChat).data.referralPartnerId, PARTNER_VALID_ID)

  await callback(fullFlowChat, 'photo:no')
  assert.equal(sessions.get(fullFlowChat).state, 'awaiting_name')
  assert.equal(sessions.get(fullFlowChat).data.referralPartnerId, PARTNER_VALID_ID)

  await message(fullFlowChat, 'Пётр')
  assert.equal(sessions.get(fullFlowChat).state, 'awaiting_phone')

  await message(fullFlowChat, '+79990001122')
  assert.equal(sessions.get(fullFlowChat).state, 'awaiting_address')

  await message(fullFlowChat, 'Санкт-Петербург')
  assert.equal(sessions.get(fullFlowChat).state, 'awaiting_date')

  await message(fullFlowChat, '25.12.2099')
  assert.equal(sessions.get(fullFlowChat).state, 'choosing_time')
  assert.equal(sessions.get(fullFlowChat).data.referralPartnerId, PARTNER_VALID_ID)

  await callback(fullFlowChat, 'time:any')
  assert.equal(sessions.get(fullFlowChat).state, 'choosing_rules_presence')

  await callback(fullFlowChat, 'rules:none')
  assert.equal(sessions.get(fullFlowChat).state, 'awaiting_confirmation')
  assert.equal(sessions.get(fullFlowChat).data.referralPartnerId, PARTNER_VALID_ID)

  await callback(fullFlowChat, 'order:submit')
  const fullFlowInsert = insertedOrders.at(-1)
  assert.equal(fullFlowInsert[21], PARTNER_VALID_ID)
  assert.equal(fullFlowInsert[22], 'telegram')

  console.log('PASS: referral attribution via /start, order referral columns, admin-only referral commands, and the full order flow end to end')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
