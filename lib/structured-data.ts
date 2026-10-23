// Pure, @/-free — the homepage JSON-LD (schema.org), built only from confirmed facts: the name,
// the site URL, the Telegram bot and the service area. No logo (CleanTrack has no approved logo
// file yet, and the OLNOO icon must not stand in for it), no address, phone, opening hours,
// prices or ratings. The FAQPage is generated from HOME_FAQ, the same array the visible FAQ
// renders, so the markup can never drift from the page text.

import { HOME_FAQ, SERVICE_AREA, TELEGRAM_CONTACT_URL, type HomeFaqItem } from './home-content'

const AREA_SERVED = [
  { '@type': 'City', name: 'Москва' },
  { '@type': 'AdministrativeArea', name: 'Московская область' },
]

export function buildHomeStructuredData(baseUrl: string, faq: HomeFaqItem[] = HOME_FAQ) {
  const url = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const organizationId = `${url}#organization`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'CleanTrack',
        url,
        sameAs: [TELEGRAM_CONTACT_URL],
        areaServed: AREA_SERVED,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: 'CleanTrack',
        url,
        inLanguage: 'ru-RU',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: SERVICE_AREA.title,
        serviceType: 'Уборка квартир и домов',
        url,
        provider: { '@id': organizationId },
        areaServed: AREA_SERVED,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        mainEntity: faq.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so text can't close the tag. */
export function serializeStructuredData(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
