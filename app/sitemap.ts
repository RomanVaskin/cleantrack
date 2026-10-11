import type { MetadataRoute } from 'next'
import { cleanTrackBaseUrl } from '@/lib/cleantrack-url'

/**
 * Public indexable pages only. `/client/[token]` and `/partner/[token]` are personal,
 * token-gated pages (cleaning tracker, partner stats) — never canonical content to index.
 * `/client` (no token) is a dead-end fallback with no real content; `/cleaner` and
 * `/cleaner/jobs/*` are the internal staff tool, not public marketing pages. `/r/[code]` is a
 * redirect route (`route.ts`), not a page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = cleanTrackBaseUrl().replace(/\/$/, '')
  return ['', '/partners'].map((path) => ({ url: `${baseUrl}${path}` }))
}
