const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const notFoundError = new Error('NEXT_NOT_FOUND')
const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === 'next/server') return { connection: async () => {} }
  if (id === 'next/navigation') return { notFound: () => { throw notFoundError } }
  if (id === '../client-view' && parent?.filename.endsWith('/app/client/[token]/page.tsx')) {
    return { ClientView: function ClientView() {} }
  }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (mod, filename) => {
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText, filename)
  }
}

async function main() {
  const cleanings = require('../lib/data/cleanings.ts')
  const route = require('../app/client/[token]/page.tsx').default
  const originalLookup = cleanings.getCleaningDataByClientToken
  try {
    cleanings.getCleaningDataByClientToken = async () => null
    await assert.rejects(
      route({ params: Promise.resolve({ token: 'invalid-token' }) }),
      error => error === notFoundError,
    )

    const expected = { cleaning: { id: 'cleaning-from-token' } }
    cleanings.getCleaningDataByClientToken = async token => token === 'valid-token' ? expected : null
    const view = await route({ params: Promise.resolve({ token: 'valid-token' }) })
    assert.equal(view.props.cleaning.id, expected.cleaning.id)

    const legacyPage = fs.readFileSync(path.join(__dirname, '../app/client/page.tsx'), 'utf8')
    assert.match(legacyPage, /Откройте персональную ссылку на уборку/)
    assert.doesNotMatch(legacyPage, /DEMO_CLEANING_ID|getCleaningData|ClientView/)
    const clientView = fs.readFileSync(path.join(__dirname, '../app/client/client-view.tsx'), 'utf8')
    assert.match(clientView, /cleaning\.client/)
    assert.doesNotMatch(clientView, /clientPhone/)
  } finally {
    cleanings.getCleaningDataByClientToken = originalLookup
  }

  console.log('PASS: token route renders matched cleaning, rejects unknown tokens, and legacy route exposes no demo cleaning')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
