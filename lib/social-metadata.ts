import type { Metadata } from 'next'

// Open Graph + Twitter Card for the public pages, so links shared in Telegram and other
// messengers render a preview card. Relative URLs resolve against `metadataBase` (app/layout.tsx).
// Next.js replaces a parent's openGraph/twitter objects instead of merging them, so each page
// that sets its own title/description builds the full set through this helper.
const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'CleanTrack — уборка квартиры с контролем результата',
}

export function socialMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: 'CleanTrack',
      url: path,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE],
    },
  }
}
