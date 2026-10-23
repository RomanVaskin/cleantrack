const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) request = path.resolve(__dirname, '..', request.slice(2))
  return originalResolve.call(this, request, ...rest)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename)
}

const { buildHomeStructuredData, serializeStructuredData } = require('../lib/structured-data.ts')
const { HOME_FAQ, SERVICE_AREA, TELEGRAM_CONTACT_URL } = require('../lib/home-content.ts')

const data = buildHomeStructuredData('https://cleantrack.ru')
assert.equal(data['@context'], 'https://schema.org')
const byType = Object.fromEntries(data['@graph'].map((node) => [node['@type'], node]))
assert.deepEqual(Object.keys(byType).sort(), ['FAQPage', 'Organization', 'Service', 'WebSite'])

// Organization: only confirmed facts.
const org = byType.Organization
assert.equal(org.name, 'CleanTrack')
assert.equal(org.url, 'https://cleantrack.ru/')
assert.deepEqual(org.sameAs, [TELEGRAM_CONTACT_URL])
assert.deepEqual(org.areaServed.map((a) => [a['@type'], a.name]), [['City', 'Москва'], ['AdministrativeArea', 'Московская область']])

// Nothing unconfirmed anywhere in the markup: no logo/image, address, phone, hours, prices, ratings.
const json = JSON.stringify(data)
for (const key of ['logo', 'image', 'address', 'telephone', 'email', 'openingHours', 'priceRange', 'offers', 'aggregateRating', 'review', 'geo']) {
  assert.equal(json.includes(`"${key}"`), false, `unexpected ${key}`)
}
assert.equal(/olnoo/i.test(json), false)
assert.equal(json.includes('LocalBusiness'), false)

// WebSite and Service point at the same organization and area.
assert.deepEqual(byType.WebSite.publisher, { '@id': org['@id'] })
assert.equal(byType.WebSite.inLanguage, 'ru-RU')
assert.deepEqual(byType.Service.provider, { '@id': org['@id'] })
assert.deepEqual(byType.Service.areaServed, org.areaServed)
assert.equal(byType.Service.name, SERVICE_AREA.title)

// FAQPage matches the visible FAQ word for word: seven questions, same order, same text.
const faq = byType.FAQPage.mainEntity
assert.equal(HOME_FAQ.length, 7)
assert.deepEqual(faq.map((q) => [q.name, q.acceptedAnswer.text]), HOME_FAQ.map((q) => [q.question, q.answer]))
assert.ok(faq.every((q) => q['@type'] === 'Question' && q.acceptedAnswer['@type'] === 'Answer'))

// The copy makes no claims the product can't back.
const copy = [SERVICE_AREA.text, ...HOME_FAQ.flatMap((q) => [q.question, q.answer])].join(' ')
for (const banned of [/гаранти/i, /₽/, /\d+\s*(мин|час)/i, /бесплатн/i, /круглосуточн/i, /район[а-я]* [А-ЯЁ]/]) {
  assert.equal(banned.test(copy), false, `unconfirmed claim ${banned}`)
}

// Serialization can't break out of the <script> tag.
const payload = serializeStructuredData({ text: '</script><script>alert(1)</script>' })
assert.equal(payload.includes('<'), false)
assert.deepEqual(JSON.parse(payload), { text: '</script><script>alert(1)</script>' })

console.log('PASS: JSON-LD Organization/WebSite/Service/FAQPage from confirmed facts, FAQ matches visible text, safe serialization')
