// Run against an explicitly provided disposable local PostgreSQL database:
// CLEANTRACK_TEST_DATABASE_URL=postgresql://localhost:55439/postgres node tests/postgres.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const url = process.env.CLEANTRACK_TEST_DATABASE_URL
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Provide CLEANTRACK_TEST_DATABASE_URL for a disposable LOCAL database')
}
process.env.DATABASE_URL = url
process.env.DEMO_CLEANING_ID = '11111111-1111-1111-1111-111111111111'

// Load the actual data layer without a Next request; only framework boundaries are stubbed.
const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === 'next/server') return { connection: async () => {} }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename)
}

const { getPostgresPool, withTransaction } = require('../lib/db/postgres.ts')
const { getCleaningData, DEMO_CLEANING_ID: id } = require('../lib/data/cleanings.ts')
const { updateChecklistItem, completeCleaning, acceptCleaning } = require('../lib/data/cleaning-actions.ts')
const mock = require('../lib/mock-data.ts')

async function main() {
  const pool = getPostgresPool()
  assert.equal(getPostgresPool(), pool)
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'))
    const migration = fs.readFileSync(path.join(__dirname, '../db/migrations/001_add_cleaning_acceptance.sql'), 'utf8')
    await pool.query(migration)
    await pool.query(migration)
    const seed = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8')
    await pool.query(seed)
    await pool.query(seed)
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM cleanings) cleanings,
      (SELECT count(*)::int FROM services) services,
      (SELECT count(*)::int FROM cleaning_services) checklist,
      (SELECT count(*)::int FROM client_rules) rules,
      (SELECT count(*)::int FROM photos) photos`)
    assert.deepEqual(counts.rows[0], { cleanings: 1, services: 12, checklist: 12, rules: 1, photos: 3 })
    const data = await getCleaningData(id)
    assert.deepEqual(data.cleaning, mock.cleaning)
    assert.deepEqual(data.clientRules, mock.clientRules)
    const visibleItem = ({ label, included, done, note, photo }) => ({ label, included, done, note, photo })
    assert.deepEqual(data.checklist.map(visibleItem), mock.getInitialChecklist().map(visibleItem))
    assert.deepEqual(data.photos.map(p => p.src).sort(), mock.photos.map(p => p.src).sort())
    const itemId = data.checklist.find(i => !i.done && i.included).id
    assert.deepEqual(await acceptCleaning(id), { ok: false })
    assert.deepEqual(await completeCleaning(id), { ok: false })
    assert.equal((await getCleaningData(id)).cleaning.status, 'in_progress')
    assert.deepEqual(await updateChecklistItem(itemId, true), { ok: true })
    let row = (await pool.query('SELECT * FROM cleaning_services WHERE id = $1', [itemId])).rows[0]
    assert.equal(row.is_done, true)
    assert.ok(row.completed_at instanceof Date)
    assert.deepEqual(await updateChecklistItem(itemId, false), { ok: true })
    row = (await pool.query('SELECT * FROM cleaning_services WHERE id = $1', [itemId])).rows[0]
    assert.equal(row.is_done, false)
    assert.equal(row.completed_at, null)
    assert.deepEqual(await updateChecklistItem('invalid uuid', true), { ok: false })
    assert.deepEqual(await updateChecklistItem(itemId, 'false'), { ok: false })
    assert.deepEqual(await updateChecklistItem('99999999-9999-9999-9999-999999999999', true), { ok: false })
    assert.deepEqual(await completeCleaning('99999999-9999-9999-9999-999999999999'), { ok: false })

    await assert.rejects(withTransaction(pool, async client => {
      await client.query("UPDATE cleanings SET number = 'rollback' WHERE id = $1", [id])
      throw new Error('test rollback')
    }))
    assert.equal((await getCleaningData(id)).cleaning.number, '124')

    for (const item of data.checklist.filter(i => i.included)) {
      assert.deepEqual(await updateChecklistItem(item.id, true), { ok: true })
    }
    // Hold the same parent lock as the write action and uncheck an item.
    // Completion must see the committed change after waiting for that lock.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT id FROM cleanings WHERE id = $1 FOR UPDATE', [id])
      await client.query('UPDATE cleaning_services SET is_done = false, completed_at = NULL WHERE id = $1', [itemId])
      const completion = completeCleaning(id)
      await client.query('COMMIT')
      assert.deepEqual(await completion, { ok: false })
    } finally { client.release() }
    assert.deepEqual(await updateChecklistItem(itemId, true), { ok: true })
    assert.deepEqual(await completeCleaning(id), { ok: true })
    assert.equal((await getCleaningData(id)).cleaning.status, 'completed')
    const acceptance = await acceptCleaning(id)
    assert.equal(acceptance.ok, true)
    assert.ok(acceptance.acceptedAt)
    const accepted = (await getCleaningData(id)).cleaning
    assert.equal(accepted.status, 'accepted')
    assert.equal(accepted.acceptedAt, acceptance.acceptedAt)
    assert.deepEqual(await acceptCleaning(id), acceptance)
    const acceptedRow = (await pool.query('SELECT status, accepted_at FROM cleanings WHERE id = $1', [id])).rows[0]
    assert.equal(acceptedRow.status, 'accepted')
    assert.equal(acceptedRow.accepted_at.toISOString(), acceptance.acceptedAt)
    assert.equal((await pool.query('SELECT count(*)::int n FROM cleaning_services WHERE NOT is_selected AND NOT is_done')).rows[0].n, 4)

    process.env.DATABASE_URL = ''
    assert.equal(getPostgresPool(), null)
    assert.deepEqual((await getCleaningData(id)).cleaning, mock.cleaning)
    assert.deepEqual(await updateChecklistItem('s4', true), { ok: true })
    assert.deepEqual(await completeCleaning(id), { ok: true })
    assert.equal((await acceptCleaning(id)).ok, true)
    assert.deepEqual(await acceptCleaning('99999999-9999-9999-9999-999999999999'), { ok: false })

    process.env.DATABASE_URL = url
    await pool.end()
    assert.deepEqual(await updateChecklistItem(itemId, true), { ok: false })
    assert.deepEqual(await completeCleaning(id), { ok: false })
    assert.deepEqual(await acceptCleaning(id), { ok: false })
    assert.deepEqual((await getCleaningData(id)).cleaning, mock.cleaning)
    console.log('PASS: seed, reads, timestamps, completion and acceptance guards, locking, mock fallback and DB failures')
  } finally {
    if (!pool.ended) await pool.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
