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
}

export default nextConfig
