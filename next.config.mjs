// Non-public sections: the internal staff tool, the token-gated personal pages, the API and the
// referral redirect. X-Robots-Tag keeps them out of search results even for responses that have
// no HTML <meta> (API, redirects, 404s); no-referrer keeps the personal tokens in these URLs from
// leaking to other sites via the Referer header. Neither header is access control.
const PRIVATE_ROUTE_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
]
const PRIVATE_ROUTE_SOURCES = [
  '/cleaner',
  '/cleaner/:path*',
  '/client',
  '/client/:path*',
  '/partner/:path*',
  '/api/:path*',
  '/r/:path*',
]

// www.cleantrack.ru serves the same site as cleantrack.ru (same server, same certificate), which
// search engines see as a duplicate host. Every www URL gets a 301 to the same path and query on
// the canonical host. 301, not `permanent: true` (that sends 308). The rule only matches the www
// Host header, so the canonical host itself is never redirected — no loop. It relies on nginx
// passing the original Host header through to Next.js.
const CANONICAL_ORIGIN = 'https://cleantrack.ru'
const WWW_HOST_PATTERN = 'www\\.cleantrack\\.ru'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return PRIVATE_ROUTE_SOURCES.map((source) => ({ source, headers: PRIVATE_ROUTE_HEADERS }))
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: WWW_HOST_PATTERN }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        statusCode: 301,
      },
    ]
  },
}

export default nextConfig
