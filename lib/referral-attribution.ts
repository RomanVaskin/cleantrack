import 'server-only'

import { cookies } from 'next/headers'
import { TELEGRAM_CONTACT_URL } from '@/lib/home-content'

export const REFERRAL_COOKIE_NAME = 'referral_code'
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/

/**
 * Reads the referral code a /r/[code] visit attributed to this browser, if any.
 * Foundation for the landing page's own referral CTA, added in a follow-up PR.
 */
export async function getReferralCodeFromCookies(): Promise<string | null> {
  const store = await cookies()
  const value = store.get(REFERRAL_COOKIE_NAME)?.value
  return value && REFERRAL_CODE_PATTERN.test(value) ? value : null
}

export function buildReferralTelegramDeepLink(code: string): string {
  return `${TELEGRAM_CONTACT_URL}?start=ref_${encodeURIComponent(code)}`
}

/**
 * The single place that decides which Telegram URL a public "order" CTA should use: the
 * referral deep link when attribution exists, otherwise the plain contact link unchanged.
 * Every homepage/partners-page order CTA should go through this instead of re-deriving it.
 */
export function resolveTelegramOrderUrl(referralCode: string | null): string {
  return referralCode ? buildReferralTelegramDeepLink(referralCode) : TELEGRAM_CONTACT_URL
}
