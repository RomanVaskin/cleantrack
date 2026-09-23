const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const sessions = new Map()
const sent = []
const answeredCallbacks = []
const confirmedOrders = []
const rejectedOrders = []
const insertedOrders = []
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
    if (sql.includes('next_number')) return { rows: [{ next_number: '1' }] }
    if (sql.includes('INSERT INTO orders')) {
      insertedOrders.push(params)
      return { rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  },
}
const pool = { query: (...args) => client.query(...args) }

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === '@/lib/db/postgres') {
    return { getPostgresPool: () => pool, withTransaction: async (_pool, work) => work(client) }
  }
  if (id === '@/lib/data/telegram-orders') {
    return {
      confirmTelegramOrder: async orderId => {
        confirmedOrders.push(orderId)
        return { kind: 'error' }
      },
      rejectTelegramOrder: async orderId => {
        rejectedOrders.push(orderId)
        return { kind: 'error' }
      },
    }
  }
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

const format = require('../lib/telegram-order-format.ts')
let bot = require('../lib/server/telegram-order-bot.ts')
const chatId = 42
const baseData = {
  rooms: 2,
  photoReportEnabled: true,
  clientName: 'Анна',
  clientPhone: '+79990000000',
  address: 'Москва',
  requestedDate: '2099-09-25',
}
const callback = data => bot.handleTelegramUpdate({
  callback_query: { id: `callback-${data}`, data, from: { username: 'anna' }, message: { message_id: 7, chat: { id: chatId } } },
})
const message = text => bot.handleTelegramUpdate({ message: { message_id: 8, chat: { id: chatId }, text } })
const seed = (state, data = baseData) => sessions.set(chatId, { state, data: structuredClone(data) })

async function main() {
  const originalAdminChatIds = process.env.TELEGRAM_ADMIN_CHAT_IDS
  const originalAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  process.env.TELEGRAM_ADMIN_CHAT_IDS = ' 99, 100, 99, , invalid, 00100, -200, 0, 1.5, 9007199254740992 '
  process.env.TELEGRAM_ADMIN_CHAT_ID = '77'
  assert.deepEqual(bot.getTelegramAdminChatIds(), ['99', '100', '-200'])

  delete process.env.TELEGRAM_ADMIN_CHAT_IDS
  process.env.TELEGRAM_ADMIN_CHAT_ID = ' 77 '
  assert.deepEqual(bot.getTelegramAdminChatIds(), ['77'])

  process.env.TELEGRAM_ADMIN_CHAT_IDS = '  '
  assert.deepEqual(bot.getTelegramAdminChatIds(), [])

  process.env.TELEGRAM_ADMIN_CHAT_IDS = '99, 100, 99, invalid, , 0100'
  process.env.TELEGRAM_ADMIN_CHAT_ID = '77'

  assert.equal(format.normalizeCustomTimeInterval('10:30-13:30'), '10:30–13:30')
  assert.equal(format.normalizeCustomTimeInterval('10:30  –  13:30'), '10:30–13:30')
  for (const value of ['24:00–13:00', '10:60–13:00', '13:30–10:30', '10:30–10:30', 'bad']) {
    assert.equal(format.normalizeCustomTimeInterval(value), null)
  }
  assert.equal(format.normalizeRequestedDate('31.02.2099'), null)
  assert.equal(format.normalizeRequestedDate('25.09.2099', new Date('2026-09-20T00:00:00Z')), '2099-09-25')

  for (const [index, interval] of format.TIME_INTERVALS.entries()) {
    seed('choosing_time')
    await callback(`time:slot:${index}`)
    assert.equal(sessions.get(chatId).data.requestedTime, interval)
    assert.equal(sessions.get(chatId).state, 'choosing_rules_presence')
  }
  seed('choosing_time')
  await callback('time:any')
  assert.equal(sessions.get(chatId).data.requestedTime, format.ANY_TIME)

  seed('choosing_time')
  await callback('time:custom')
  assert.equal(sessions.get(chatId).state, 'awaiting_custom_time')
  await message('25:00-26:00')
  assert.equal(sessions.get(chatId).state, 'awaiting_custom_time')
  assert.match(sent.at(-1).text, /10:30–13:30/)
  await message('10:30-13:30')
  assert.equal(sessions.get(chatId).data.requestedTime, '10:30–13:30')

  // Persisted JSONB state remains sufficient after reloading the bot module.
  seed('awaiting_custom_time')
  delete require.cache[require.resolve('../lib/server/telegram-order-bot.ts')]
  bot = require('../lib/server/telegram-order-bot.ts')
  await message('11:00-14:00')
  assert.equal(sessions.get(chatId).data.requestedTime, '11:00–14:00')

  seed('choosing_rules_presence', { ...baseData, requestedTime: format.ANY_TIME })
  await callback('rules:none')
  assert.equal(sessions.get(chatId).state, 'awaiting_confirmation')
  assert.deepEqual(
    { cabinets: sessions.get(chatId).data.cabinetsRule, items: sessions.get(chatId).data.personalItemsRule, untouched: sessions.get(chatId).data.doNotTouch },
    { cabinets: 'none', items: 'none', untouched: '' },
  )
  assert.match(sent.at(-1).text, /Правила клиента: особых правил нет/)
  assert.match(sent.at(-1).text, /Время: Время не важно/)

  seed('choosing_rules_presence', { ...baseData, requestedTime: '09:00–12:00' })
  await callback('rules:yes')
  assert.equal(sessions.get(chatId).state, 'choosing_cabinets_rule')
  await callback('cabinets:selected')
  assert.equal(sessions.get(chatId).data.cabinetsRule, 'selected')
  await callback('items:agree')
  assert.equal(sessions.get(chatId).data.personalItemsRule, 'agree')
  assert.equal(sessions.get(chatId).state, 'awaiting_do_not_touch')
  await message('Документы на столе')
  assert.equal(sessions.get(chatId).data.doNotTouch, 'Документы на столе')
  assert.match(sent.at(-1).text, /Шкафы: только указанные клиентом/)
  assert.match(sent.at(-1).text, /Личные вещи: только после согласования/)

  seed('awaiting_do_not_touch', { ...baseData, requestedTime: '12:00–15:00', cabinetsRule: 'all', personalItemsRule: 'return' })
  await callback('do-not-touch:none')
  assert.equal(sessions.get(chatId).data.doNotTouch, '')

  seed('awaiting_confirmation', {
    ...baseData,
    requestedTime: '15:00–18:00',
    cabinetsRule: 'selected',
    personalItemsRule: 'agree',
    doNotTouch: 'Документы',
  })
  await callback('order:submit')
  assert.equal(sessions.has(chatId), false)
  assert.equal(insertedOrders.length, 1)
  assert.equal(insertedOrders[0][12], '2099-09-25')
  assert.equal(insertedOrders[0][13], '15:00–18:00')
  assert.equal(insertedOrders[0][14], 'selected')
  assert.equal(insertedOrders[0][15], 'agree')
  assert.equal(insertedOrders[0][16], 'Документы')
  const adminNotifications = sent.filter(item => ['99', '100'].includes(String(item.chatId)))
  assert.deepEqual(adminNotifications.map(item => String(item.chatId)), ['99', '100'])
  for (const notification of adminNotifications) {
    assert.match(notification.text, /Время: 15:00–18:00/)
    assert.match(notification.text, /Не трогать: Документы/)
  }

  const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const adminCallback = (adminChatId, action) => bot.handleTelegramUpdate({
    callback_query: {
      id: `admin-${adminChatId}-${action}`,
      data: `admin:${action}:${orderId}`,
      from: { username: 'admin' },
      message: { message_id: 9, chat: { id: adminChatId } },
    },
  })
  await adminCallback(99, 'confirm')
  await adminCallback(100, 'reject')
  assert.deepEqual(confirmedOrders, [orderId])
  assert.deepEqual(rejectedOrders, [orderId])

  await adminCallback(101, 'confirm')
  assert.deepEqual(confirmedOrders, [orderId])
  assert.equal(answeredCallbacks.at(-1).text, 'Недоступно.')

  const clientView = fs.readFileSync(path.join(__dirname, '../app/client/client-view.tsx'), 'utf8')
  const cleanerView = fs.readFileSync(path.join(__dirname, '../app/cleaner/cleaner-view.tsx'), 'utf8')
  assert.match(clientView, /clientRules\.doNotTouch/)
  assert.match(cleanerView, /clientRules\.doNotTouch/)
  assert.match(cleanerView, /clientRules\.doNotTouch &&/)
  const cleaningsSource = fs.readFileSync(path.join(__dirname, '../lib/data/cleanings.ts'), 'utf8')
  assert.doesNotMatch(cleaningsSource, /const clientRules:[\s\S]{0,500}: mockClientRules/)
  if (originalAdminChatIds === undefined) delete process.env.TELEGRAM_ADMIN_CHAT_IDS
  else process.env.TELEGRAM_ADMIN_CHAT_IDS = originalAdminChatIds
  if (originalAdminChatId === undefined) delete process.env.TELEGRAM_ADMIN_CHAT_ID
  else process.env.TELEGRAM_ADMIN_CHAT_ID = originalAdminChatId
  console.log('PASS: Telegram admin IDs, time, rules, persisted sessions, summaries, order fields and tracker wiring')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
