import { execFileSync } from 'node:child_process'
import type { MetadataRoute } from 'next'
import { cleanTrackBaseUrl } from '@/lib/cleantrack-url'

/**
 * Public indexable pages only. `/client/[token]` and `/partner/[token]` are personal,
 * token-gated pages (cleaning tracker, partner stats) — never canonical content to index.
 * `/client` (no token) is a dead-end fallback with no real content; `/cleaner` and
 * `/cleaner/jobs/*` are the internal staff tool, not public marketing pages. `/r/[code]` is a
 * redirect route (`route.ts`), not a page.
 *
 * `lastmod` is the date of the last commit touching the files that make up each page's content.
 * The sitemap is prerendered at build time, so this reads the git history of the build checkout.
 * In a shallow clone that history is cut off and every file would get the same wrong date, so
 * there — or without git at all — `lastmod` is omitted rather than guessed.
 */
const PAGES: { path: string; sources: string[] }[] = [
  {
    path: '',
    sources: [
      'app/page.tsx',
      'lib/home-content.ts',
      'components/home/price-quiz.tsx',
      'components/home/tracker-mockup.tsx',
    ],
  },
  { path: '/partners', sources: ['app/partners/page.tsx'] },
]

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function lastModified(sources: string[]): Date | undefined {
  try {
    if (git(['rev-parse', '--is-shallow-repository']) !== 'false') return undefined
    const committedAt = git(['log', '-1', '--format=%cI', '--', ...sources])
    return committedAt ? new Date(committedAt) : undefined
  } catch {
    return undefined
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = cleanTrackBaseUrl().replace(/\/$/, '')
  return PAGES.map(({ path, sources }) => {
    const lastModifiedAt = lastModified(sources)
    return { url: `${baseUrl}${path}`, ...(lastModifiedAt && { lastModified: lastModifiedAt }) }
  })
}
