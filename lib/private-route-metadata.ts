import type { Metadata } from 'next'

// Shared by the layouts of the non-public sections (/cleaner, /client, /partner): the internal
// staff tool and the token-gated personal pages must never appear in search results. This only
// keeps them out of the index — it is not access control (see next.config.mjs for the matching
// X-Robots-Tag header, which also covers the API and the /r/ redirect).
export const privateRouteMetadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}
