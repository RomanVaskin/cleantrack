import 'server-only'

type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
}

type ReplyKeyboardMarkup = {
  keyboard: Array<Array<{ text: string; request_contact?: boolean }>>
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
}

type ReplyKeyboardRemove = { remove_keyboard: true }

export type TelegramReplyMarkup =
  | InlineKeyboardMarkup
  | ReplyKeyboardMarkup
  | ReplyKeyboardRemove

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Telegram bot token is not configured')
  return token
}

async function callTelegram(method: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${getBotToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`Telegram API request failed: ${method}`)
  const result = await response.json() as { ok?: boolean }
  if (!result.ok) throw new Error(`Telegram API rejected request: ${method}`)
}

export function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<void> {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  })
}

export function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export function editMessageReplyMarkup(
  chatId: number | string,
  messageId: number,
  replyMarkup: InlineKeyboardMarkup,
): Promise<void> {
  return callTelegram('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  })
}
