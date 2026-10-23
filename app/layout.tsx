import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { cleanTrackBaseUrl } from '@/lib/cleantrack-url'
import { socialMetadata } from '@/lib/social-metadata'
import './globals.css'

const SITE_TITLE = 'Уборка квартир и домов в Москве и Московской области — CleanTrack'
const SITE_DESCRIPTION =
  'Уборка квартир и домов в Москве и Московской области. Клинер работает по чек-листу, а вы видите статус, выполненные работы и фото в персональном трекере.'

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
      </body>
    </html>
  )
}
