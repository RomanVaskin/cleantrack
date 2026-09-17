const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const redirects = []
const notFoundError = new Error('NEXT_NOT_FOUND')
const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === 'next/server') return { connection: async () => {} }
  if (id === 'next/navigation') return {
    redirect: value => { redirects.push(value); throw new Error('NEXT_REDIRECT') },
    notFound: () => { throw notFoundError },
  }
  if (id === '../../cleaner-view' && parent?.filename.endsWith('/app/cleaner/jobs/[id]/page.tsx')) {
    return { CleanerView: function CleanerView() {} }
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
  const cleanerPage = require('../app/cleaner/page.tsx').default
  assert.throws(() => cleanerPage(), /NEXT_REDIRECT/)
  assert.deepEqual(redirects, ['/cleaner/jobs'])

  const cleanings = require('../lib/data/cleanings.ts')
  const originalGet = cleanings.getCleaningData
  const route = require('../app/cleaner/jobs/[id]/page.tsx').default
  try {
    cleanings.getCleaningData = async () => ({ cleaning: { id: 'job-1' } })
    const view = await route({ params: Promise.resolve({ id: 'job-1' }) })
    assert.equal(view.props.cleaning.id, 'job-1')

    cleanings.getCleaningData = async () => ({ cleaning: { id: 'different-job' } })
    await assert.rejects(
      route({ params: Promise.resolve({ id: 'missing-job' }) }),
      error => error === notFoundError,
    )

    const viewSource = fs.readFileSync(path.join(__dirname, '../app/cleaner/cleaner-view.tsx'), 'utf8')
    assert.match(viewSource, /href="\/cleaner\/jobs"/)
    assert.match(viewSource, /К списку уборок/)
    const listSource = fs.readFileSync(path.join(__dirname, '../app/cleaner/jobs/page.tsx'), 'utf8')
    assert.match(listSource, /ProgressBar/)
    assert.match(listSource, /Открыть/)
    assert.match(listSource, /href="\/cleaner\/jobs\/new"/)
    assert.match(listSource, /Новая уборка/)
    const newPageSource = fs.readFileSync(path.join(__dirname, '../app/cleaner/jobs/new/page.tsx'), 'utf8')
    assert.match(newPageSource, /NewCleaningForm/)
    const newFormSource = fs.readFileSync(path.join(__dirname, '../app/cleaner/jobs/new/new-cleaning-form.tsx'), 'utf8')
    assert.match(newFormSource, /Создать уборку/)
    assert.match(newFormSource, /Создаём…/)
  } finally {
    cleanings.getCleaningData = originalGet
  }

  console.log('PASS: cleaner redirect, job route lookup/404, list card and back navigation')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
