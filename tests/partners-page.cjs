const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

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

async function renderPartnersPage() {
  const ReactDOMServer = require('react-dom/server')
  const page = require('../app/partners/page.tsx')
  const element = await page.default()
  return { html: ReactDOMServer.renderToStaticMarkup(element), metadata: page.metadata }
}

async function main() {
  // #3 /partners exists, renders, and contains the required content.
  cookieValue = null
  const { html, metadata } = await renderPartnersPage()

  assert.ok(html.includes('Партнёрская программа CleanTrack'))
  assert.ok(html.includes('10%'))
  assert.ok(html.includes('Стать партнёром'))
  assert.ok(html.includes('start=partner'), 'missing the ?start=partner deep link')
  assert.ok(html.includes('Персональные данные клиента партнёру не показываются.'))

  // Required blocks per spec, each present at least once.
  for (const marker of [
    'Кому подходит',
    'Как это работает',
    'Что видно партнёру',
    'Пример',
    'Условия',
    'Вопросы и ответы',
    'Администраторам Telegram-чатов ЖК',
    'Риелторам',
    'Стандартная комиссия — 10%',
    'Сколько я получаю?',
    'Как стать партнёром?',
  ]) {
    assert.ok(html.includes(marker), `/partners missing "${marker}"`)
  }

  // Not promising a fixed/guaranteed income (the page explicitly disclaims this instead), and
  // not inventing payout timing/minimums/tax terms that don't exist in the system yet.
  assert.ok(html.includes('а не гарантированный доход'), '/partners should explicitly disclaim a guaranteed income')
  assert.ok(!/мы гарантируем|гарантированный доход \d/i.test(html), '/partners must not promise a guaranteed income')
  for (const forbidden of ['срок выплат', 'минимальн', 'налог']) {
    assert.ok(!html.toLowerCase().includes(forbidden), `/partners invented an unconfirmed term: "${forbidden}"`)
  }

  // SEO metadata.
  assert.equal(metadata.title, 'Партнёрская программа CleanTrack — 10% с выполненных заказов')
  assert.match(metadata.description, /10%/)
  assert.equal(metadata.alternates.canonical, 'https://cleantrack.ru/partners')

  // The page's own "Заказать уборку" CTA is referral-aware too, through the same shared helper.
  assert.ok(html.includes('href="https://t.me/CleanTrackRuBot"'))
  cookieValue = 'PARTNER01'
  const { html: refHtml } = await renderPartnersPage()
  assert.ok(refHtml.includes('start=ref_PARTNER01'), '/partners order CTA ignored the referral cookie')
  assert.ok(refHtml.includes('start=partner'), '"Стать партнёром" must stay fixed even with a referral cookie')

  console.log('PASS: /partners renders required content, metadata, and a referral-aware order CTA')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
