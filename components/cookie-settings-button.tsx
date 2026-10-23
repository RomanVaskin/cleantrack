'use client'

import { OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/yandex-metrika'

/** Footer link that reopens the analytics consent banner (components/yandex-metrika.tsx). */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
    >
      Настройки cookie
    </button>
  )
}
