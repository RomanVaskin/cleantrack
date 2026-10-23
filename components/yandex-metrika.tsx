'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import {
  ANALYTICS_CONSENT_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  TELEGRAM_ORDER_GOAL,
  YANDEX_METRIKA_ID,
  YANDEX_METRIKA_SNIPPET,
  isAnalyticsPath,
  isMetrikaStorageKey,
  isTelegramOrderUrl,
  type AnalyticsConsent,
} from '@/lib/yandex-metrika'

// Yandex Metrika for the public pages, loaded only after the visitor accepts analytics in the
// banner below (152-FZ: Metrika's cookies and identifiers are personal data). Mounted once in
// app/layout.tsx, so it survives client-side navigation: the counter is initialised once per
// page load, and each later route change is sent as a single `hit`. Private sections (see
// isAnalyticsPath) never load it, never show the banner and never send hits.
//
// The footer's «Настройки cookie» (components/cookie-settings-button.tsx) reopens the banner.
// tag.js can't be stopped once loaded, so withdrawing consent deletes Metrika's cookies and
// storage and reloads the page — the reload renders without the counter.

type Ym = (id: number, method: string, ...args: unknown[]) => void

function ym(method: string, ...args: unknown[]) {
  const fn = (window as unknown as { ym?: Ym }).ym
  fn?.(YANDEX_METRIKA_ID, method, ...args)
}

function readConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

function saveConsent(value: AnalyticsConsent) {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value)
  } catch {
    // Storage blocked: the choice applies to this page view only.
  }
}

/** Deletes the _ym* cookies (on every domain level tag.js may use) and _ym* storage keys. */
function clearMetrikaData() {
  const labels = window.location.hostname.split('.')
  const domains = ['', ...labels.slice(0, -1).map((_, i) => `; domain=.${labels.slice(i).join('.')}`)]
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim()
    if (!isMetrikaStorageKey(name)) continue
    for (const domain of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
  }
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      Object.keys(storage).filter(isMetrikaStorageKey).forEach((key) => storage.removeItem(key))
    } catch {
      // Storage blocked: nothing of Metrika's can be in it either.
    }
  }
}

/** Stops collection on a page where tag.js already runs: wipe its data, reload without it. */
function withdrawLoadedCounter() {
  clearMetrikaData()
  window.location.reload()
}

export function YandexMetrika() {
  const pathname = usePathname()
  const isPublic = isAnalyticsPath(pathname)
  // undefined until read on the client, so the server render and hydration never show the banner.
  const [consent, setConsent] = useState<AnalyticsConsent | null | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // URL of the last page view Metrika has counted: init counts the page it starts on.
  const lastTrackedUrl = useRef<string | null>(null)

  useEffect(() => {
    setConsent(readConsent())
    const openSettings = () => setSettingsOpen(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
  }, [])

  // Consent withdrawn in another tab: this tab stops collecting too.
  useEffect(() => {
    if (!loaded) return
    function onStorage(event: StorageEvent) {
      if (event.key === ANALYTICS_CONSENT_KEY && event.newValue !== 'granted') withdrawLoadedCounter()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [loaded])

  useEffect(() => {
    if (consent === 'granted' && isPublic && !loaded) {
      lastTrackedUrl.current = window.location.href
      setLoaded(true)
    }
  }, [consent, isPublic, loaded])

  // Client-side navigation: one hit per new public URL. The first page is counted by init.
  useEffect(() => {
    if (!loaded || !isPublic) return
    const url = window.location.href
    if (url === lastTrackedUrl.current) return
    ym('hit', url, { referer: lastTrackedUrl.current ?? undefined, title: document.title })
    lastTrackedUrl.current = url
  }, [loaded, isPublic, pathname])

  // One delegated listener for every Telegram order link (header, hero, price quiz, final CTA,
  // footer): a single goal per click, however the link is rendered. Middle-click counts too.
  useEffect(() => {
    if (!loaded) return
    function onClick(event: MouseEvent) {
      if (event.type === 'auxclick' && event.button !== 1) return
      if (!isAnalyticsPath(window.location.pathname)) return
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (link instanceof HTMLAnchorElement && isTelegramOrderUrl(link.href)) {
        ym('reachGoal', TELEGRAM_ORDER_GOAL)
      }
    }
    document.addEventListener('click', onClick)
    document.addEventListener('auxclick', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('auxclick', onClick)
    }
  }, [loaded])

  function choose(value: AnalyticsConsent) {
    saveConsent(value)
    if (value === 'denied' && loaded) {
      withdrawLoadedCounter()
      return
    }
    setConsent(value)
    setSettingsOpen(false)
  }

  return (
    <>
      {loaded && (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {YANDEX_METRIKA_SNIPPET}
        </Script>
      )}
      {consent !== undefined && (consent === null || settingsOpen) && isPublic && (
        <div
          role="region"
          aria-label="Согласие на аналитику"
          className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-foreground/5 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Мы используем cookie и Яндекс Метрику, чтобы анализировать посещаемость сайта.
              Метрика включится только с вашего согласия.
              {consent !== null && (
                <span className="mt-1 block font-medium text-foreground">
                  {consent === 'granted' ? 'Сейчас аналитика включена.' : 'Сейчас аналитика отключена.'}
                </span>
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" className="flex-1 rounded-full px-4 sm:flex-none" onClick={() => choose('granted')}>
                Принять
              </Button>
              <Button size="sm" variant="outline" className="flex-1 rounded-full px-4 sm:flex-none" onClick={() => choose('denied')}>
                Отказаться
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
