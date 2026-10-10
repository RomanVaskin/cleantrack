const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const notFoundError = new Error('NEXT_NOT_FOUND')

let activePartnerByCode = null
let partnerByToken = null

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === 'next/server') {
    return {
      connection: async () => {},
      NextResponse: {
        redirect: (url) => {
          const cookieCalls = []
          return {
            url: url.toString(),
            cookies: { set: (name, value, options) => cookieCalls.push({ name, value, options }) },
            _cookieCalls: cookieCalls,
          }
        },
      },
    }
  }
  if (id === 'next/navigation') return { notFound: () => { throw notFoundError } }
  if (id === 'next/headers') return { cookies: async () => ({ get: () => undefined }) }
  if (id === '@/lib/data/referral-partners') {
    return {
      getActiveReferralPartnerByCode: async (code) => (code === activePartnerByCode?.code ? activePartnerByCode : null),
      getReferralPartnerByAccessToken: async (token) => (token === partnerByToken?.token ? partnerByToken.detail : null),
    }
  }
  if (id === '@/lib/home-content') {
    return { TELEGRAM_CONTACT_URL: 'https://t.me/CleanTrackRuBot', formatRub: (amount) => `${amount} ₽` }
  }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (mod, filename) => {
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename)
  }
}

async function main() {
  const route = require('../app/r/[code]/route.ts')
  const page = require('../app/partner/[token]/page.tsx').default

  // #11 a valid, active partner code sets the attribution cookie and redirects home
  activePartnerByCode = { id: 'partner-1', code: 'VALID1' }
  const okResponse = await route.GET(
    { url: 'https://cleantrack.ru/r/VALID1' },
    { params: Promise.resolve({ code: 'VALID1' }) },
  )
  assert.equal(okResponse.url, 'https://cleantrack.ru/')
  assert.equal(okResponse._cookieCalls.length, 1)
  const [cookieCall] = okResponse._cookieCalls
  assert.equal(cookieCall.name, 'referral_code')
  assert.equal(cookieCall.value, 'VALID1')
  assert.equal(cookieCall.options.httpOnly, true)
  assert.equal(cookieCall.options.sameSite, 'lax')
  assert.equal(cookieCall.options.maxAge, 60 * 60 * 24 * 30)

  // #11 an unknown/invalid code still redirects home, but sets no cookie at all
  const badResponse = await route.GET(
    { url: 'https://cleantrack.ru/r/NOPE' },
    { params: Promise.resolve({ code: 'NOPE' }) },
  )
  assert.equal(badResponse.url, 'https://cleantrack.ru/')
  assert.equal(badResponse._cookieCalls.length, 0)

  // #12 an invalid/unknown partner access token renders 404
  partnerByToken = null
  await assert.rejects(
    page({ params: Promise.resolve({ token: 'not-a-real-token' }) }),
    (error) => error === notFoundError,
  )

  // A valid token renders the partner's own stats, with no PII in the rendered output.
  partnerByToken = {
    token: 'a'.repeat(32),
    detail: {
      id: 'partner-1',
      name: 'Иван',
      code: 'VALID1',
      active: true,
      commissionPercent: 10,
      ordersCount: 1,
      totalAmount: 1000,
      completedAmount: 1000,
      accruedCommission: 100,
      orders: [{
        id: 'o1', number: 'CT-000001', createdAt: new Date().toISOString(),
        totalPrice: 1000, statusLabel: 'Выполнен', completed: true, commission: 100,
      }],
    },
  }
  const element = await page({ params: Promise.resolve({ token: 'a'.repeat(32) }) })
  const rendered = JSON.stringify(element)
  assert.match(rendered, /Иван/)
  assert.match(rendered, /CT-000001/)
  assert.doesNotMatch(rendered, /clientPhone|clientName|телефон|Телефон/i)

  console.log('PASS: /r/[code] attribution cookie and /partner/[token] 404 / PII-free rendering')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
