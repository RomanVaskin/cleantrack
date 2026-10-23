'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import {
  ANALYTICS_CONSENT_KEY,
  TELEGRAM_ORDER_GOAL,
  YANDEX_METRIKA_ID,
  YANDEX_METRIKA_SNIPPET,
  isAnalyticsPath,
  isTelegramOrderUrl,
  type AnalyticsConsent,
} from '@/lib/yandex-metrika'

// Yandex Metrika for the public pages, loaded only after the visitor accepts analytics in the
// banner below (152-FZ: Metrika's cookies and identifiers are personal data). Mounted once in
// app/layout.tsx, so it survives client-side navigation: the counter is initialised once per
// page load, and each later route change is sent as a single `hit`. Private sections (see
// isAnalyticsPath) never load it, never show the banner and never send hits.

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

export function YandexMetrika() {
  const pathname = usePathname()
  const isPublic = isAnalyticsPath(pathname)
  // undefined until read on the client, so the server render and hydration never show the banner.
  const [consent, setConsent] = useState<AnalyticsConsent | null | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  // URL of the last page view Metrika has counted: init counts the page it starts on.
  const lastTrackedUrl = useRef<string | null>(null)

  useEffect(() => {
    setConsent(readConsent())
  }, [])

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
    setConsent(value)
  }

  return (
    <>
      {loaded && (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {YANDEX_METRIKA_SNIPPET}
        </Script>
      )}
      {consent === null && isPublic && (
        <div
          role="region"
          aria-label="Согласие на аналитику"
          className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-foreground/5 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Мы используем cookie и Яндекс Метрику, чтобы анализировать посещаемость сайта.
              Метрика включится только с вашего согласия.
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
