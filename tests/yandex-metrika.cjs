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

const metrika = require('../lib/yandex-metrika.ts')

// Counter id, goal name and the init options the task requires.
assert.equal(metrika.YANDEX_METRIKA_ID, 113761686)
assert.equal(metrika.TELEGRAM_ORDER_GOAL, 'telegram_click')
assert.match(metrika.YANDEX_METRIKA_SNIPPET, /mc\.yandex\.ru\/metrika\/tag\.js\?id=113761686/)
assert.match(metrika.YANDEX_METRIKA_SNIPPET, /ym\(113761686,'init',\{[^}]*webvisor:true/)
assert.match(metrika.YANDEX_METRIKA_SNIPPET, /clickmap:true/)
assert.equal((metrika.YANDEX_METRIKA_SNIPPET.match(/'init'/g) || []).length, 1)

// One run queues exactly one init; a second run of the loader never adds a second tag.js.
const inserted = []
const fakeDocument = {
  scripts: [],
  createElement: () => ({}),
  getElementsByTagName: () => [{ parentNode: { insertBefore: (k) => { inserted.push(k); fakeDocument.scripts.push(k) } } }],
}
const fakeWindow = {}
const [loader, init] = metrika.YANDEX_METRIKA_SNIPPET.split('\n')
new Function('window', 'document', `${loader}\nwindow.${init}`)(fakeWindow, fakeDocument)
assert.deepEqual(fakeWindow.ym.a.map((args) => args[1]), ['init'])
new Function('window', 'document', loader)(fakeWindow, fakeDocument)
assert.equal(inserted.length, 1)
assert.equal(inserted[0].src, 'https://mc.yandex.ru/metrika/tag.js?id=113761686')

// Analytics only on public pages.
for (const p of ['/', '/partners', '/partners/', '/privacy']) assert.equal(metrika.isAnalyticsPath(p), true, p)
for (const p of ['/cleaner', '/cleaner/jobs', '/cleaner/jobs/new', '/client', '/client/abc', '/partner/abc', '/partner']) {
  assert.equal(metrika.isAnalyticsPath(p), false, p)
}

// Order links count; the partner application and other links do not.
assert.equal(metrika.isTelegramOrderUrl('https://t.me/CleanTrackRuBot'), true)
assert.equal(metrika.isTelegramOrderUrl('https://t.me/CleanTrackRuBot?start=ref_ABC123'), true)
assert.equal(metrika.isTelegramOrderUrl('https://t.me/CleanTrackRuBot?start=partner'), false)
assert.equal(metrika.isTelegramOrderUrl('https://t.me/SomeOtherBot'), false)
assert.equal(metrika.isTelegramOrderUrl('https://cleantrack.ru/partners'), false)
assert.equal(metrika.isTelegramOrderUrl('#price'), false)

console.log('PASS: Metrika counter id, init options, single tag.js load, public-only paths, telegram_click link matching')
