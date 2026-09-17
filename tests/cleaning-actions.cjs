const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

let getPostgresPoolCalls = 0

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === '@/lib/db/postgres') {
    return {
      getPostgresPool: () => {
        getPostgresPoolCalls += 1
        return null
      },
      withTransaction: async () => {
        throw new Error('withTransaction should not be called')
      },
    }
  }
  if (id === '@/lib/data/cleanings') return { DEMO_CLEANING_ID: '11111111-1111-1111-1111-111111111111' }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
  }).outputText, filename)
}

const { createCleaning } = require('../lib/data/cleaning-actions.ts')

const baseInput = {
  clientName: 'Новый клиент',
  address: 'Новый адрес',
  cabinets: 'none',
  moveItems: 'none',
}

async function main() {
  assert.deepEqual(await createCleaning({
    ...baseInput,
    selectedServiceIds: ['22222222-2222-2222-2222-222222222201'],
  }), { ok: false, error: 'server' })
  assert.equal(getPostgresPoolCalls, 1)

  getPostgresPoolCalls = 0
  assert.deepEqual(await createCleaning({
    ...baseInput,
    selectedServiceIds: ['not-a-uuid'],
  }), { ok: false, error: 'validation', field: 'serviceId' })
  assert.equal(getPostgresPoolCalls, 0)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
