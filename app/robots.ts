import type { MetadataRoute } from 'next'
import { cleanTrackBaseUrl } from '@/lib/cleantrack-url'

/**
 * The public site is open to crawlers. No `Disallow` — the token-gated personal pages
 * (/client/[token], /partner/[token]) and the internal /cleaner tool aren't guessable/public
 * content and aren't excluded here on purpose. Sitemap is the existing app/sitemap.ts
 * (https://cleantrack.ru/sitemap.xml).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = cleanTrackBaseUrl().replace(/\/$/, '')
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
