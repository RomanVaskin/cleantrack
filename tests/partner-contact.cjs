const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const sessions = new Map()
const sent = []

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
    return { confirmTelegramOrder: async () => ({ kind: 'error' }), rejectTelegramOrder: async () => ({ kind: 'error' }) }
  }
  if (id === '@/lib/data/referral-partners') {
    return { getActiveReferralPartnerByCode: async (code) => (code === 'VALID1' ? { id: 'p1', code: 'VALID1' } : null) }
  }
  if (id === '@/lib/home-content') return { TELEGRAM_CONTACT_URL: 'https://t.me/CleanTrackRuBot' }
  if (id === '@/lib/server/telegram-api') {
    return {
      sendMessage: async (chatId, text, markup) => { sent.push({ chatId, text, markup }) },
      answerCallbackQuery: async () => {},
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

let nextChatId = 1000
function freshChatId() {
  nextChatId += 1
  return nextChatId
}

async function startPartner(chatId) {
  await bot.handleTelegramUpdate({
    message: { message_id: 1, chat: { id: chatId }, text: '/start partner', from: { username: 'ivan' } },
  })
}

function lastFor(chatId) {
  return [...sent].reverse().find((item) => item.chatId === chatId)
}

async function main() {
  delete process.env.TELEGRAM_ADMIN_CHAT_IDS
  delete process.env.TELEGRAM_ADMIN_CHAT_ID

  // A: a valid TELEGRAM_ADMIN_USERNAME produces a "Написать администратору" button whose url
  // is exactly https://t.me/<username>, and the misleading "напишите сюда" copy is gone.
  process.env.TELEGRAM_ADMIN_USERNAME = 'olnooai'
  assert.equal(bot.getTelegramAdminUsername(), 'olnooai')
  const chatA = freshChatId()
  await startPartner(chatA)
  const replyA = lastFor(chatA)
  assert.ok(replyA.markup, 'expected an inline keyboard when the username is valid')
  const buttonA = replyA.markup.inline_keyboard[0][0]
  assert.equal(buttonA.text, 'Написать администратору')
  assert.equal(buttonA.url, 'https://t.me/olnooai')
  assert.equal(buttonA.callback_data, undefined)
  assert.doesNotMatch(replyA.text, /напишите (нам )?(прямо )?сюда/i)
  assert.match(replyA.text, /партнёром CleanTrack/)

  // B: no TELEGRAM_ADMIN_USERNAME configured -> no crash, no button, a clear fallback instead.
  delete process.env.TELEGRAM_ADMIN_USERNAME
  assert.equal(bot.getTelegramAdminUsername(), null)
  const chatB = freshChatId()
  await startPartner(chatB)
  const replyB = lastFor(chatB)
  assert.equal(replyB.markup, undefined, 'no button should be sent without a configured username')
  assert.match(replyB.text, /уже получил уведомление/)
  assert.doesNotMatch(replyB.text, /напишите (нам )?(прямо )?сюда/i)

  // C: an invalid/unsafe value never builds a t.me URL and falls back exactly like "absent".
  const invalidValues = [
    'ab',                       // too short
    '1abc_long_enough_name',    // starts with a digit
    'bad username!',            // spaces and punctuation
    'javascript:alert(1)',      // scheme injection attempt
    'https://evil.example.com', // full URL, not a bare username
    '../../etc/passwd',         // path traversal-shaped
    '<script>alert(1)</script>',
  ]
  for (const value of invalidValues) {
    process.env.TELEGRAM_ADMIN_USERNAME = value
    assert.equal(bot.getTelegramAdminUsername(), null, `expected "${value}" to be rejected`)
    const chatC = freshChatId()
    await startPartner(chatC)
    const replyC = lastFor(chatC)
    assert.equal(replyC.markup, undefined, `a button must not be built from "${value}"`)
    assert.match(replyC.text, /уже получил уведомление/)
    assert.ok(!replyC.text.includes(value), `the raw invalid value "${value}" leaked into the reply`)
  }
  delete process.env.TELEGRAM_ADMIN_USERNAME

  // D: plain /start and /start ref_CODE are unaffected by any of this.
  const chatPlain = freshChatId()
  await bot.handleTelegramUpdate({ message: { message_id: 1, chat: { id: chatPlain }, text: '/start' } })
  const replyPlain = lastFor(chatPlain)
  assert.equal(replyPlain.markup.inline_keyboard[0][0].callback_data, 'order:start')
  assert.match(replyPlain.text, /Добро пожаловать в CleanTrack/)

  const chatRef = freshChatId()
  await bot.handleTelegramUpdate({ message: { message_id: 1, chat: { id: chatRef }, text: '/start ref_VALID1' } })
  const replyRef = lastFor(chatRef)
  assert.equal(replyRef.markup.inline_keyboard[0][0].callback_data, 'order:start:ref:p1')
  assert.match(replyRef.text, /Добро пожаловать в CleanTrack/)

  console.log('PASS: /start partner admin-contact button, safe username validation, and unaffected /start / /start ref_CODE')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
