import { handleTelegramUpdate, type TelegramUpdate } from '@/lib/server/telegram-order-bot'

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('[telegram-webhook] Bot token is not configured')
    return Response.json({ ok: false }, { status: 503 })
  }

  try {
    const update = await request.json() as TelegramUpdate
    if (update && typeof update === 'object') await handleTelegramUpdate(update)
  } catch {
    // Do not log update contents, Telegram API URLs, tokens, or customer data.
    console.error('[telegram-webhook] Update processing failed')
  }

  // Telegram receives an acknowledgement even for unsupported or malformed updates.
  return Response.json({ ok: true })
}
