import 'server-only'

import type { PoolClient } from 'pg'
import { getPostgresPool, withTransaction } from '@/lib/db/postgres'
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  sendMessage,
  type TelegramReplyMarkup,
} from '@/lib/server/telegram-api'

type SessionState =
  | 'choosing_rooms'
  | 'choosing_extras'
  | 'awaiting_windows_count'
  | 'awaiting_ironing_hours'
  | 'awaiting_other_request'
  | 'awaiting_photo_report'
  | 'awaiting_name'
  | 'awaiting_phone'
  | 'awaiting_address'
  | 'awaiting_confirmation'

type SessionData = {
  rooms?: number
  windows?: boolean
  ironing?: boolean
  balcony?: boolean
  other?: boolean
  photoReportEnabled?: boolean
  windowsCount?: number
  ironingHours?: number
  otherRequest?: string
  clientName?: string
  clientPhone?: string
  address?: string
}

type Session = { state: SessionState; data: SessionData }

type TelegramUser = { username?: string }
type TelegramMessage = {
  message_id: number
  chat: { id: number }
  from?: TelegramUser
  text?: string
  contact?: { phone_number?: string }
}
type TelegramCallbackQuery = {
  id: string
  from: TelegramUser
  data?: string
  message?: TelegramMessage
}
export type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

const ROOM_PRICES: Record<number, number> = { 1: 4000, 2: 4500, 3: 5000, 4: 5500 }

const startKeyboard: TelegramReplyMarkup = {
  inline_keyboard: [[{ text: 'Заказать уборку', callback_data: 'order:start' }]],
}

const roomsKeyboard: TelegramReplyMarkup = {
  inline_keyboard: [
    [{ text: '1 комната — 4 000 ₽', callback_data: 'room:1' }],
    [{ text: '2 комнаты — 4 500 ₽', callback_data: 'room:2' }],
    [{ text: '3 комнаты — 5 000 ₽', callback_data: 'room:3' }],
    [{ text: '4 комнаты — 5 500 ₽', callback_data: 'room:4' }],
  ],
}

const windowsKeyboard: TelegramReplyMarkup = {
  inline_keyboard: [
    [1, 2, 3].map((count) => ({ text: String(count), callback_data: `windows:${count}` })),
    [4, 5].map((count) => ({ text: String(count), callback_data: `windows:${count}` }))
      .concat([{ text: '6+', callback_data: 'windows:custom' }]),
  ],
}

const ironingKeyboard: TelegramReplyMarkup = {
  inline_keyboard: [
    [1, 2, 3].map((hours) => ({
      text: `${hours} ${hours === 1 ? 'час' : 'часа'}`,
      callback_data: `ironing:${hours}`,
    })),
    [{ text: 'Другое количество', callback_data: 'ironing:custom' }],
  ],
}

const confirmationKeyboard: TelegramReplyMarkup = {
  inline_keyboard: [
    [{ text: '✅ Отправить заявку', callback_data: 'order:submit' }],
    [{ text: 'Изменить заказ', callback_data: 'order:edit' }],
  ],
}

const photoReportKeyboard: TelegramReplyMarkup = {
  inline_keyboard: [
    [{ text: 'Да, нужен фотоотчёт', callback_data: 'photo:yes' }],
    [{ text: 'Нет, без фото', callback_data: 'photo:no' }],
  ],
}

function extrasKeyboard(data: SessionData): TelegramReplyMarkup {
  const mark = (selected?: boolean) => selected ? '✅' : '⬜'
  return {
    inline_keyboard: [
      [{ text: `${mark(data.windows)} Окна — 800 ₽ / окно`, callback_data: 'extra:windows' }],
      [{ text: `${mark(data.ironing)} Глажка — 800 ₽ / час`, callback_data: 'extra:ironing' }],
      [{ text: `${mark(data.balcony)} Балкон / лоджия — 1 000 ₽`, callback_data: 'extra:balcony' }],
      [{ text: `${mark(data.other)} Другое`, callback_data: 'extra:other' }],
      [{ text: 'Готово', callback_data: 'extra:done' }],
    ],
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU').format(price).replace(/\u00a0/g, ' ')
}

function roomLabel(rooms: number): string {
  return `${rooms} ${rooms === 1 ? 'комната' : 'комнаты'}`
}

function countLabel(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100
  const mod10 = count % 10
  const noun = mod100 >= 11 && mod100 <= 14
    ? many
    : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many
  return `${count} ${noun}`
}

function calculatePrice(data: SessionData) {
  const basePrice = ROOM_PRICES[data.rooms ?? 0] ?? 0
  const extrasPrice = (data.windowsCount ?? 0) * 800
    + (data.ironingHours ?? 0) * 800
    + (data.balcony ? 1000 : 0)
  return { basePrice, extrasPrice, totalPrice: basePrice + extrasPrice }
}

function confirmationText(data: SessionData): string {
  const { basePrice, totalPrice } = calculatePrice(data)
  const lines = [
    'Ваш заказ',
    '',
    'Уборка квартиры',
    `${roomLabel(data.rooms!)} — ${formatPrice(basePrice)} ₽`,
  ]
  if (data.windowsCount) {
    lines.push(`${countLabel(data.windowsCount, 'окно', 'окна', 'окон')} — ${formatPrice(data.windowsCount * 800)} ₽`)
  }
  if (data.ironingHours) {
    lines.push(`${countLabel(data.ironingHours, 'час глажки', 'часа глажки', 'часов глажки')} — ${formatPrice(data.ironingHours * 800)} ₽`)
  }
  if (data.balcony) lines.push('Балкон / лоджия — 1 000 ₽')
  lines.push('', `Предварительная стоимость: ${formatPrice(totalPrice)} ₽`, '')
  if (data.otherRequest) {
    lines.push('Дополнительно:', data.otherRequest, '', 'Стоимость этой услуги будет согласована отдельно.', '')
  }
  lines.push(`Фотоотчёт: ${data.photoReportEnabled ? 'да' : 'нет'}`, '')
  lines.push(
    `Имя: ${data.clientName}`,
    `Телефон: ${data.clientPhone}`,
    `Адрес: ${data.address}`,
    '',
    'Окончательная стоимость подтверждается перед уборкой.',
  )
  return lines.join('\n')
}

async function loadSession(client: PoolClient, chatId: number, lock = false): Promise<Session | null> {
  const result = await client.query<{ state: string; data: SessionData }>(
    `SELECT state, data FROM telegram_sessions WHERE chat_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [chatId],
  )
  const row = result.rows[0]
  if (!row) return null
  return { state: row.state as SessionState, data: row.data ?? {} }
}

async function saveSession(client: PoolClient, chatId: number, session: Session): Promise<void> {
  await client.query(
    `INSERT INTO telegram_sessions (chat_id, state, data, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (chat_id) DO UPDATE
     SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = now()`,
    [chatId, session.state, JSON.stringify(session.data)],
  )
}

async function resetToRooms(client: PoolClient, chatId: number): Promise<void> {
  await saveSession(client, chatId, { state: 'choosing_rooms', data: {} })
}

async function nextAfterExtras(client: PoolClient, chatId: number, data: SessionData) {
  if (data.windows && !data.windowsCount) {
    await saveSession(client, chatId, { state: 'awaiting_windows_count', data })
    return { text: 'Сколько окон нужно помыть?', markup: windowsKeyboard }
  }
  if (data.ironing && !data.ironingHours) {
    await saveSession(client, chatId, { state: 'awaiting_ironing_hours', data })
    return { text: 'Сколько часов глажки добавить?', markup: ironingKeyboard }
  }
  if (data.other && !data.otherRequest) {
    await saveSession(client, chatId, { state: 'awaiting_other_request', data })
    return { text: 'Напишите, что ещё необходимо сделать.\nСтоимость согласуем отдельно.' }
  }
  await saveSession(client, chatId, { state: 'awaiting_photo_report', data })
  return {
    text: 'Нужен фотоотчёт после уборки?\n\nФото используются только для подтверждения выполненной работы в вашей персональной ссылке.',
    markup: photoReportKeyboard,
  }
}

async function start(chatId: number): Promise<void> {
  const pool = getPostgresPool()
  if (pool) await pool.query('DELETE FROM telegram_sessions WHERE chat_id = $1', [chatId])
  await sendMessage(
    chatId,
    'Добро пожаловать в CleanTrack.\n\nЗакажите уборку квартиры за пару минут.',
    startKeyboard,
  )
}

async function requirePool(chatId: number) {
  const pool = getPostgresPool()
  if (pool) return pool
  await sendMessage(chatId, 'Сервис временно недоступен. Попробуйте позже.')
  return null
}

async function sendRestart(chatId: number): Promise<void> {
  await sendMessage(chatId, 'Не удалось продолжить оформление. Отправьте /start, чтобы начать заново.')
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id
  const text = message.text?.trim() ?? ''
  if (/^\/start(?:@\w+)?(?:\s|$)/.test(text)) return start(chatId)

  const pool = await requirePool(chatId)
  if (!pool) return

  const response = await withTransaction(pool, async (client) => {
    const session = await loadSession(client, chatId, true)
    if (!session) return { restart: true as const }

    if (session.state === 'awaiting_windows_count') {
      if (!/^\d+$/.test(text) || Number(text) < 6 || !Number.isSafeInteger(Number(text))) {
        return { text: 'Напишите точное количество окон цифрой — целое число не меньше 6.' }
      }
      session.data.windowsCount = Number(text)
      return nextAfterExtras(client, chatId, session.data)
    }

    if (session.state === 'awaiting_ironing_hours') {
      if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 12) {
        return { text: 'Напишите целое количество часов от 1 до 12.' }
      }
      session.data.ironingHours = Number(text)
      return nextAfterExtras(client, chatId, session.data)
    }

    if (session.state === 'awaiting_other_request') {
      if (!text || text.length > 1000) return { text: 'Опишите пожелание текстом длиной до 1000 символов.' }
      session.data.otherRequest = text
      return nextAfterExtras(client, chatId, session.data)
    }

    if (session.state === 'awaiting_name') {
      if (!text || text.length > 120) return { text: 'Введите имя длиной от 1 до 120 символов.' }
      session.data.clientName = text
      await saveSession(client, chatId, { state: 'awaiting_phone', data: session.data })
      return {
        text: 'Укажите номер телефона.',
        markup: {
          keyboard: [[{ text: 'Отправить номер телефона', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        } satisfies TelegramReplyMarkup,
      }
    }

    if (session.state === 'awaiting_phone') {
      const phone = message.contact?.phone_number?.trim() || text
      if (phone.length < 3 || phone.length > 40 || !/\d/.test(phone)) {
        return { text: 'Отправьте номер кнопкой ниже или напишите номер длиной до 40 символов.' }
      }
      session.data.clientPhone = phone
      await saveSession(client, chatId, { state: 'awaiting_address', data: session.data })
      return {
        text: 'Укажите адрес уборки.',
        markup: { remove_keyboard: true } satisfies TelegramReplyMarkup,
      }
    }

    if (session.state === 'awaiting_address') {
      if (!text || text.length > 300) return { text: 'Введите адрес длиной от 1 до 300 символов.' }
      session.data.address = text
      await saveSession(client, chatId, { state: 'awaiting_confirmation', data: session.data })
      return { text: confirmationText(session.data), markup: confirmationKeyboard }
    }

    return { restart: true as const }
  })

  if ('restart' in response) return sendRestart(chatId)
  await sendMessage(chatId, response.text, response.markup)
}

async function handleCallback(callback: TelegramCallbackQuery): Promise<void> {
  try {
    await answerCallbackQuery(callback.id)
  } catch {
    console.error('[telegram-webhook] Failed to acknowledge callback')
  }

  const message = callback.message
  if (!message) return
  const chatId = message.chat.id
  const action = callback.data ?? ''
  const pool = await requirePool(chatId)
  if (!pool) return

  if (action === 'order:start' || action === 'order:edit') {
    await withTransaction(pool, (client) => resetToRooms(client, chatId))
    await sendMessage(chatId, 'Сколько комнат в квартире?', roomsKeyboard)
    return
  }

  if (action === 'order:submit') {
    const result = await withTransaction(pool, async (client) => {
      const session = await loadSession(client, chatId, true)
      if (!session || session.state !== 'awaiting_confirmation') return null
      const data = session.data
      if (
        !data.rooms
        || typeof data.photoReportEnabled !== 'boolean'
        || !data.clientName
        || !data.clientPhone
        || !data.address
      ) return null
      const { basePrice, extrasPrice, totalPrice } = calculatePrice(data)

      await client.query("SELECT pg_advisory_xact_lock(hashtext('cleantrack_order_number'))")
      const numberResult = await client.query<{ next_number: string }>(
        `SELECT (COALESCE(MAX(substring(number FROM '^CT-([0-9]+)$')::bigint), 0) + 1)::text AS next_number
         FROM orders WHERE number ~ '^CT-[0-9]+$'`,
      )
      const number = `CT-${numberResult.rows[0].next_number.padStart(6, '0')}`
      await client.query(
        `INSERT INTO orders
          (number, telegram_chat_id, telegram_username, client_name, client_phone,
           address, rooms, windows_count, ironing_hours, balcony, photo_report_enabled,
           other_request, base_price, extras_price, total_price, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'new')`,
        [
          number, chatId, callback.from.username ?? null, data.clientName, data.clientPhone,
          data.address, data.rooms, data.windowsCount ?? 0, data.ironingHours ?? 0,
          Boolean(data.balcony), data.photoReportEnabled, data.otherRequest ?? null,
          basePrice, extrasPrice, totalPrice,
        ],
      )
      await client.query('DELETE FROM telegram_sessions WHERE chat_id = $1', [chatId])
      return { number, totalPrice }
    })

    if (!result) {
      await sendMessage(chatId, 'Эта заявка уже отправлена или устарела. Отправьте /start для нового заказа.')
      return
    }
    await sendMessage(
      chatId,
      `✅ Заявка ${result.number} принята.\n\n`
        + `Предварительная стоимость: ${formatPrice(result.totalPrice)} ₽\n\n`
        + 'Мы свяжемся с вами для подтверждения заказа и окончательной стоимости.\n\n'
        + 'После подтверждения вы получите персональную ссылку CleanTrack, где сможете следить за выполнением уборки.',
    )
    return
  }

  const response = await withTransaction(pool, async (client) => {
    const session = await loadSession(client, chatId, true)
    if (!session) return { restart: true as const }

    if (action.startsWith('room:') && session.state === 'choosing_rooms') {
      const rooms = Number(action.slice(5))
      if (!ROOM_PRICES[rooms]) return { restart: true as const }
      const data: SessionData = { rooms }
      await saveSession(client, chatId, { state: 'choosing_extras', data })
      return { text: 'Что добавить к уборке?', markup: extrasKeyboard(data) }
    }

    if (action.startsWith('extra:') && session.state === 'choosing_extras') {
      const extra = action.slice(6)
      if (extra === 'done') return nextAfterExtras(client, chatId, session.data)
      if (!['windows', 'ironing', 'balcony', 'other'].includes(extra)) return { restart: true as const }
      const key = extra as 'windows' | 'ironing' | 'balcony' | 'other'
      session.data[key] = !session.data[key]
      if (key === 'windows' && !session.data.windows) delete session.data.windowsCount
      if (key === 'ironing' && !session.data.ironing) delete session.data.ironingHours
      if (key === 'other' && !session.data.other) delete session.data.otherRequest
      await saveSession(client, chatId, session)
      return { editMarkup: extrasKeyboard(session.data) }
    }

    if (action.startsWith('windows:') && session.state === 'awaiting_windows_count') {
      const value = action.slice(8)
      if (value === 'custom') return { text: 'Напишите точное количество окон цифрой.' }
      const count = Number(value)
      if (!Number.isInteger(count) || count < 1 || count > 5) return { restart: true as const }
      session.data.windowsCount = count
      return nextAfterExtras(client, chatId, session.data)
    }

    if (action.startsWith('ironing:') && session.state === 'awaiting_ironing_hours') {
      const value = action.slice(8)
      if (value === 'custom') return { text: 'Напишите целое количество часов от 1 до 12.' }
      const hours = Number(value)
      if (!Number.isInteger(hours) || hours < 1 || hours > 3) return { restart: true as const }
      session.data.ironingHours = hours
      return nextAfterExtras(client, chatId, session.data)
    }

    if (action.startsWith('photo:') && session.state === 'awaiting_photo_report') {
      const value = action.slice(6)
      if (value !== 'yes' && value !== 'no') return { restart: true as const }
      session.data.photoReportEnabled = value === 'yes'
      await saveSession(client, chatId, { state: 'awaiting_name', data: session.data })
      return { text: 'Как к вам обращаться?' }
    }

    return { restart: true as const }
  })

  if ('restart' in response) return sendRestart(chatId)
  if ('editMarkup' in response) {
    await editMessageReplyMarkup(chatId, message.message_id, response.editMarkup as Extract<TelegramReplyMarkup, { inline_keyboard: unknown }>)
    return
  }
  await sendMessage(chatId, response.text, response.markup)
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query)
  if (update.message) return handleMessage(update.message)
}
