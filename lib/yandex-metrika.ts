// Pure, @/-free — Yandex Metrika settings and the rules for where it may run, shared by
// components/yandex-metrika.tsx and tests/yandex-metrika.cjs.

import { TELEGRAM_CONTACT_URL } from './home-content'

export const YANDEX_METRIKA_ID = 113761686

/** Goal sent when a visitor opens the Telegram bot to place an order. */
export const TELEGRAM_ORDER_GOAL = 'telegram_click'

/** localStorage key holding the visitor's analytics choice: 'granted' or 'denied'. */
export const ANALYTICS_CONSENT_KEY = 'cleantrack_analytics_consent'

export type AnalyticsConsent = 'granted' | 'denied'

/**
 * The official tag.js loader followed by `init`. The loader's own loop skips a second copy of
 * tag.js, and the component renders this once per page load, so the counter is initialised once.
 * `init` sends the first page view itself; later client-side navigations are sent as `hit`.
 */
export const YANDEX_METRIKA_SNIPPET = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}','ym');
ym(${YANDEX_METRIKA_ID},'init',{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});`

/**
 * Analytics runs on the public site only. The internal /cleaner tool shows client names,
 * addresses and phones, and /client/[token] and /partner/[token] carry personal tokens in the
 * URL — Webvisor must never record those pages. `/partner` without the trailing "s" is the
 * private section; `/partners` is the public partner-program page.
 */
export function isAnalyticsPath(pathname: string): boolean {
  return !/^\/(cleaner|client|partner)(\/|$)/.test(pathname)
}

/**
 * An order link: the CleanTrack bot, plain or with a referral deep link (`?start=ref_…`). The
 * partner-application link (`?start=partner`) is not an order.
 */
export function isTelegramOrderUrl(href: string): boolean {
  try {
    const url = new URL(href)
    const bot = new URL(TELEGRAM_CONTACT_URL)
    return url.host === bot.host
      && url.pathname.replace(/\/$/, '') === bot.pathname
      && url.searchParams.get('start') !== 'partner'
  } catch {
    return false
  }
}
