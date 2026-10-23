import type { MetadataRoute } from 'next'
import { cleanTrackBaseUrl } from '@/lib/cleantrack-url'

/**
 * The public site (/ and /partners) is open to crawlers. The internal /cleaner tool, the
 * token-gated personal pages (/client/[token], /partner/[token]), the API and the /r/[code]
 * referral redirect are disallowed. `/partner/` keeps its trailing slash so /partners stays open.
 * Disallow is only a crawling hint — those sections also send noindex (their layouts and the
 * X-Robots-Tag header in next.config.mjs), and neither is access control.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = cleanTrackBaseUrl().replace(/\/$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cleaner', '/client', '/partner/', '/api/', '/r/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
