import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { YandexMetrika } from '@/components/yandex-metrika'
import { cleanTrackBaseUrl } from '@/lib/cleantrack-url'
import { socialMetadata } from '@/lib/social-metadata'
import './globals.css'

const SITE_TITLE = 'Уборка квартир в Москве и МО с контролем качества | CleanTrack'
const SITE_DESCRIPTION =
  'Закажите уборку квартиры в Москве и Московской области. Чек-лист работ, контроль качества и фотоотчёт по желанию. Рассчитайте стоимость онлайн.'

export const metadata: Metadata = {
  metadataBase: new URL(cleanTrackBaseUrl()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  generator: 'v0.app',
  ...socialMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: '/' }),
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="light bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <YandexMetrika />
      </body>
    </html>
  )
}
