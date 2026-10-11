const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

// Renders the real homepage server component through react-dom/server (already a dependency),
// with only next/headers' cookies() mocked. Everything else — Logo, Button, PriceQuiz,
// TrackerMockup, lucide icons — loads and renders for real, so these tests exercise the actual
// composed page, not a stand-in.

let cookieValue = null

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === 'next/headers') {
    return {
      cookies: async () => ({
        get: (name) => (name === 'referral_code' && cookieValue ? { value: cookieValue } : undefined),
      }),
    }
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

async function renderHomepage() {
  const ReactDOMServer = require('react-dom/server')
  const page = require('../app/page.tsx')
  const element = await page.default()
  return ReactDOMServer.renderToStaticMarkup(element)
}

async function main() {
  // #2 homepage without a referral cookie uses the plain Telegram contact URL everywhere.
  cookieValue = null
  const plainHtml = await renderHomepage()
  assert.ok(plainHtml.includes('href="https://t.me/CleanTrackRuBot"'), 'plain Telegram URL missing without a cookie')
  assert.ok(!plainHtml.includes('start=ref_'), 'a referral deep link appeared with no referral cookie')
  // The homepage referral teaser block and its CTAs are present regardless of attribution state.
  assert.ok(plainHtml.includes('Зарабатывайте вместе с CleanTrack'))
  assert.ok(plainHtml.includes('Подробнее о партнёрской программе'))
  assert.ok(plainHtml.includes('href="/partners"'))
  assert.ok(plainHtml.includes('start=partner'), '"Стать партнёром" CTA must always use the fixed partner link')

  // #1 homepage with a valid referral cookie turns every order CTA into the ref_<CODE> deep link.
  cookieValue = 'ABCD1234'
  const refHtml = await renderHomepage()
  assert.ok(refHtml.includes('start=ref_ABCD1234'), 'referral deep link missing with a valid cookie')
  // No bare (query-string-less) contact link should remain once attribution is active — every
  // order CTA went through resolveTelegramOrderUrl().
  assert.ok(!refHtml.includes('href="https://t.me/CleanTrackRuBot"'), 'a non-attributed order CTA slipped through')
  // The fixed "Стать партнёром" link is unaffected by attribution — it never becomes ref_-wired.
  assert.ok(refHtml.includes('start=partner'), '"Стать партнёром" CTA must stay the fixed partner link')
  assert.ok(!refHtml.includes('start=ref_ABCD1234&amp;start=partner'), 'partner CTA must not merge with the referral link')

  // #4 an invalid/malicious cookie value is never reflected into the page, and the homepage
  // falls back to the plain Telegram URL exactly like the no-cookie case — the existing
  // REFERRAL_CODE_PATTERN validation (lib/referral-attribution.ts, from PR #5) is reused as-is.
  cookieValue = '<script>alert(1)</script>'
  const unsafeHtml = await renderHomepage()
  assert.ok(!unsafeHtml.includes('<script>alert'), 'an invalid cookie value leaked into the rendered page')
  assert.ok(unsafeHtml.includes('href="https://t.me/CleanTrackRuBot"'), 'invalid cookie should fall back to the plain URL')

  cookieValue = '../../etc/passwd'
  const pathLikeHtml = await renderHomepage()
  assert.ok(pathLikeHtml.includes('href="https://t.me/CleanTrackRuBot"'), 'path-like cookie should fall back to the plain URL')

  // #5 existing homepage sections and CTAs are unchanged by this patch.
  for (const marker of [
    'Уборка квартиры',
    'Рассчитать стоимость',
    'Как работает CleanTrack',
    'Вы видите, за что платите',
    'Вся уборка — в одной ссылке',
    'Что входит в базовую уборку',
    'Почему CleanTrack',
    'Чистая квартира без лишнего контроля с вашей стороны',
    'cleantrack.ru',
  ]) {
    assert.ok(plainHtml.includes(marker), `homepage regression: missing "${marker}"`)
  }

  console.log('PASS: homepage referral-aware Telegram CTAs, fixed partner CTA, cookie-format safety, and no homepage regressions')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
