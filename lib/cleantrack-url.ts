// Pure, @/-free — the CleanTrack base URL, shared by lib/server/telegram-order-bot.ts (referral
// links sent over Telegram) and the app/robots.ts and app/sitemap.ts SEO routes.

const DEFAULT_BASE_URL = 'https://cleantrack.ru'

export function cleanTrackBaseUrl(): string {
  const configured = process.env.CLEANTRACK_BASE_URL?.trim() || DEFAULT_BASE_URL
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid protocol')
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return `${DEFAULT_BASE_URL}/`
  }
}

export function cleanTrackUrl(path: string): string {
  return new URL(path.replace(/^\//, ''), cleanTrackBaseUrl()).toString()
}
