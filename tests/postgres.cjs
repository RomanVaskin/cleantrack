// Run against an explicitly provided disposable local PostgreSQL database:
// CLEANTRACK_TEST_DATABASE_URL=postgresql://localhost:55439/postgres node tests/postgres.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const url = process.env.CLEANTRACK_TEST_DATABASE_URL
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Provide CLEANTRACK_TEST_DATABASE_URL for a disposable LOCAL database')
}
process.env.DATABASE_URL = url
process.env.DEMO_CLEANING_ID = '11111111-1111-1111-1111-111111111111'
const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cleantrack-delete-test-'))
process.env.CLEANTRACK_UPLOAD_DIR = uploadDirectory

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
const {
  getCleaningData,
  getCleaningDataByClientToken,
  getCleanerCleanings,
  DEMO_CLEANING_ID: id,
} = require('../lib/data/cleanings.ts')
const {
  updateChecklistItem,
  completeCleaning,
  acceptCleaning,
  getOrCreateClientLink,
  updateCleaningClient,
  createCleaning,
  deleteCleaning,
} = require('../lib/data/cleaning-actions.ts')
const mock = require('../lib/mock-data.ts')

async function main() {
  const pool = getPostgresPool()
  assert.equal(getPostgresPool(), pool)
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'))
    for (const name of [
      '001_add_cleaning_acceptance.sql',
      '002_add_cleaning_completion.sql',
      '003_add_client_token.sql',
      '004_add_client_phone.sql',
    ]) {
      const migration = fs.readFileSync(path.join(__dirname, '../db/migrations', name), 'utf8')
      await pool.query(migration)
      await pool.query(migration)
    }
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
    const cleanerCleanings = await getCleanerCleanings()
    assert.equal(cleanerCleanings.length, 1)
    assert.equal(cleanerCleanings[0].id, id)
    assert.deepEqual(cleanerCleanings[0].progress, { done: 3, total: 8, percent: 38 })
    assert.equal(cleanerCleanings[0].status, 'in_progress')
    assert.deepEqual(data.cleaning, mock.cleaning)
    assert.deepEqual(data.clientRules, mock.clientRules)
    const visibleItem = ({ label, included, done, note, photo }) => ({ label, included, done, note, photo })
    assert.deepEqual(data.checklist.map(visibleItem), mock.getInitialChecklist().map(visibleItem))
    assert.deepEqual(data.photos.map(p => p.src).sort(), mock.photos.map(p => p.src).sort())

    assert.deepEqual(await createCleaning({
      clientName: ' ',
      address: 'Адрес',
      selectedServiceIds: [],
      cabinets: 'none',
      moveItems: 'none',
    }), { ok: false, error: 'validation', field: 'clientName' })
    assert.deepEqual(await createCleaning({
      clientName: 'Новый клиент',
      address: ' ',
      selectedServiceIds: [],
      cabinets: 'none',
      moveItems: 'none',
    }), { ok: false, error: 'validation', field: 'address' })
    assert.deepEqual(await createCleaning({
      clientName: 'Новый клиент',
      address: 'Новый адрес',
      selectedServiceIds: [],
      cabinets: 'none',
      moveItems: 'none',
    }), { ok: false, error: 'validation', field: 'services' })
    assert.deepEqual(await createCleaning({
      clientName: 'Новый клиент',
      address: 'Новый адрес',
      selectedServiceIds: ['99999999-9999-4999-8999-999999999999'],
      cabinets: 'none',
      moveItems: 'none',
    }), { ok: false, error: 'validation', field: 'serviceId' })

    const serviceIds = (await pool.query(
      "SELECT id FROM services WHERE code IN ('s1', 's3') ORDER BY code",
    )).rows.map(row => row.id)
    const created = await createCleaning({
      clientName: '  Новый клиент  ',
      clientPhone: '  +7 900 000-00-00 ',
      address: '  Новый адрес  ',
      selectedServiceIds: serviceIds,
      cabinets: 'selected',
      moveItems: 'return',
      doNotTouch: 'Документы',
      wishes: 'Средство клиента',
    })
    assert.equal(created.ok, true)
    assert.ok(created.cleaningId)
    const createdRow = (await pool.query(
      'SELECT number, status, started_at, completed_at, accepted_at, client_token FROM cleanings WHERE id = $1',
      [created.cleaningId],
    )).rows[0]
    assert.match(createdRow.number, /^\d+$/)
    assert.equal(createdRow.status, 'in_progress')
    assert.ok(createdRow.started_at instanceof Date)
    assert.equal(createdRow.completed_at, null)
    assert.equal(createdRow.accepted_at, null)
    assert.equal(createdRow.client_token, null)
    const createdServices = await pool.query(
      'SELECT service_id, is_done, completed_at FROM cleaning_services WHERE cleaning_id = $1 ORDER BY service_id',
      [created.cleaningId],
    )
    assert.deepEqual(createdServices.rows.map(row => row.service_id), serviceIds)
    assert.ok(createdServices.rows.every(row => row.is_done === false && row.completed_at === null))
    const createdRules = (await pool.query(
      'SELECT cabinets_access, personal_items_access, do_not_touch, special_requests FROM client_rules WHERE cleaning_id = $1',
      [created.cleaningId],
    )).rows[0]
    assert.deepEqual(createdRules, {
      cabinets_access: 'selected',
      personal_items_access: 'return',
      do_not_touch: 'Документы',
      special_requests: 'Средство клиента',
    })
    assert.ok((await getCleanerCleanings()).some(cleaning => cleaning.id === created.cleaningId))
    const createdData = await getCleaningData(created.cleaningId)
    assert.equal(createdData.cleaning.client, 'Новый клиент')
    assert.equal(createdData.cleaning.clientToken, null)
    assert.equal(createdData.checklist.length, 2)
    const createdItemId = createdData.checklist[0].id
    const demoItemId = data.checklist.find(i => !i.done && i.included).id
    assert.deepEqual(await updateChecklistItem(created.cleaningId, createdItemId, true), { ok: true })
    assert.equal((await pool.query('SELECT is_done FROM cleaning_services WHERE id = $1', [createdItemId])).rows[0].is_done, true)
    assert.deepEqual(await updateChecklistItem(id, createdItemId, false), { ok: false })
    assert.equal((await pool.query('SELECT is_done FROM cleaning_services WHERE id = $1', [createdItemId])).rows[0].is_done, true)
    assert.deepEqual(await completeCleaning(created.cleaningId), { ok: false })
    const createdOtherItemId = createdData.checklist[1].id
    assert.deepEqual(await updateChecklistItem(created.cleaningId, createdOtherItemId, true), { ok: true })
    const createdCompletion = await completeCleaning(created.cleaningId)
    assert.equal(createdCompletion.ok, true)
    assert.ok(createdCompletion.completedAt)
    assert.deepEqual(await completeCleaning(created.cleaningId), createdCompletion)
    assert.equal((await pool.query('SELECT status FROM cleanings WHERE id = $1', [created.cleaningId])).rows[0].status, 'completed')

    assert.equal(await getCleaningDataByClientToken('unknown-token'), null)
    assert.deepEqual(await getOrCreateClientLink('99999999-9999-9999-9999-999999999999'), { ok: false })
    const clientLink = await getOrCreateClientLink(id)
    assert.equal(clientLink.ok, true)
    assert.match(clientLink.token, /^[A-Za-z0-9_-]{32}$/)
    assert.notEqual(clientLink.token, id)
    assert.deepEqual(await getOrCreateClientLink(id), clientLink)
    const storedToken = (
      await pool.query('SELECT client_token FROM cleanings WHERE id = $1', [id])
    ).rows[0].client_token
    assert.equal(storedToken, clientLink.token)
    const linkedData = await getCleaningDataByClientToken(clientLink.token)
    assert.equal(linkedData.cleaning.id, id)
    assert.equal(linkedData.cleaning.clientToken, clientLink.token)
    assert.deepEqual(await updateCleaningClient(id, {
      clientName: ' ',
      clientPhone: '',
      address: 'Новый адрес',
    }), { ok: false })
    assert.deepEqual(await updateCleaningClient(id, {
      clientName: 'Клиент',
      clientPhone: '1'.repeat(41),
      address: 'Новый адрес',
    }), { ok: false })
    assert.deepEqual(await updateCleaningClient(id, {
      clientName: 'Клиент',
      clientPhone: '',
      address: 'а'.repeat(301),
    }), { ok: false })
    assert.deepEqual(await updateCleaningClient('99999999-9999-9999-9999-999999999999', {
      clientName: 'Клиент',
      clientPhone: '',
      address: 'Новый адрес',
    }), { ok: false })
    assert.deepEqual(await updateCleaningClient(id, {
      clientName: '  Мария  ',
      clientPhone: '  +7 999 123-45-67  ',
      address: '  Москва, Тверская улица, 1  ',
    }), { ok: true })
    const updatedCleaning = (await getCleaningData(id)).cleaning
    assert.equal(updatedCleaning.client, 'Мария')
    assert.equal(updatedCleaning.clientPhone, '+7 999 123-45-67')
    assert.equal(updatedCleaning.address, 'Москва, Тверская улица, 1')
    assert.equal(updatedCleaning.clientToken, clientLink.token)
    const updatedLinkedData = await getCleaningDataByClientToken(clientLink.token)
    assert.equal(updatedLinkedData.cleaning.client, 'Мария')
    assert.equal(updatedLinkedData.cleaning.clientPhone, '+7 999 123-45-67')
    assert.equal(updatedLinkedData.cleaning.address, 'Москва, Тверская улица, 1')
    assert.deepEqual(await getOrCreateClientLink(id), clientLink)
    const itemId = demoItemId
    assert.deepEqual(await acceptCleaning(id), { ok: false })
    assert.deepEqual(await completeCleaning(id), { ok: false })
    assert.equal((await getCleaningData(id)).cleaning.status, 'in_progress')
    assert.deepEqual(await updateChecklistItem(id, itemId, true), { ok: true })
    let row = (await pool.query('SELECT * FROM cleaning_services WHERE id = $1', [itemId])).rows[0]
    assert.equal(row.is_done, true)
    assert.ok(row.completed_at instanceof Date)
    assert.deepEqual(await updateChecklistItem(id, itemId, false), { ok: true })
    row = (await pool.query('SELECT * FROM cleaning_services WHERE id = $1', [itemId])).rows[0]
    assert.equal(row.is_done, false)
    assert.equal(row.completed_at, null)
    assert.deepEqual(await updateChecklistItem('invalid uuid', itemId, true), { ok: false })
    assert.deepEqual(await updateChecklistItem(id, itemId, 'false'), { ok: false })
    assert.deepEqual(await updateChecklistItem(id, '99999999-9999-9999-9999-999999999999', true), { ok: false })
    assert.deepEqual(await completeCleaning('99999999-9999-9999-9999-999999999999'), { ok: false })

    await assert.rejects(withTransaction(pool, async client => {
      await client.query("UPDATE cleanings SET number = 'rollback' WHERE id = $1", [id])
      throw new Error('test rollback')
    }))
    assert.equal((await getCleaningData(id)).cleaning.number, '124')

    for (const item of data.checklist.filter(i => i.included)) {
      assert.deepEqual(await updateChecklistItem(id, item.id, true), { ok: true })
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
    assert.deepEqual(await updateChecklistItem(id, itemId, true), { ok: true })
    const completion = await completeCleaning(id)
    assert.equal(completion.ok, true)
    assert.ok(completion.completedAt)
    const completed = (await getCleaningData(id)).cleaning
    assert.equal(completed.status, 'completed')
    assert.equal(completed.completedAt, completion.completedAt)
    assert.deepEqual(await completeCleaning(id), completion)
    const completedAtBeforeAcceptance = (
      await pool.query('SELECT completed_at FROM cleanings WHERE id = $1', [id])
    ).rows[0].completed_at.toISOString()
    const linkedCompleted = await getCleaningDataByClientToken(clientLink.token)
    assert.equal(linkedCompleted.cleaning.status, 'completed')
    const acceptance = await acceptCleaning(linkedCompleted.cleaning.id)
    assert.equal(acceptance.ok, true)
    assert.ok(acceptance.acceptedAt)
    const accepted = (await getCleaningData(id)).cleaning
    assert.equal(accepted.status, 'accepted')
    assert.equal(accepted.acceptedAt, acceptance.acceptedAt)
    const linkedAccepted = await getCleaningDataByClientToken(clientLink.token)
    assert.equal(linkedAccepted.cleaning.status, 'accepted')
    assert.equal(linkedAccepted.cleaning.acceptedAt, acceptance.acceptedAt)
    assert.deepEqual(await acceptCleaning(id), acceptance)
    const acceptedRow = (
      await pool.query('SELECT status, completed_at, accepted_at FROM cleanings WHERE id = $1', [id])
    ).rows[0]
    assert.equal(acceptedRow.status, 'accepted')
    assert.equal(acceptedRow.completed_at.toISOString(), completedAtBeforeAcceptance)
    assert.equal(acceptedRow.accepted_at.toISOString(), acceptance.acceptedAt)
    assert.deepEqual(await completeCleaning(id), { ok: false })
    assert.equal((await pool.query('SELECT count(*)::int n FROM cleaning_services WHERE NOT is_selected AND NOT is_done')).rows[0].n, 4)

    const deletion = await createCleaning({
      clientName: 'Удаляемый клиент',
      address: 'Адрес удаления',
      selectedServiceIds: serviceIds,
      cabinets: 'none',
      moveItems: 'none',
    })
    assert.equal(deletion.ok, true)
    const deletionId = deletion.cleaningId
    const deletionToken = 'delete-cleaning-token'
    await pool.query('UPDATE cleanings SET status = $2, client_token = $3 WHERE id = $1', [deletionId, 'accepted', deletionToken])
    const deletedPhoto = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
    const retainedPhoto = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg'
    fs.writeFileSync(path.join(uploadDirectory, deletedPhoto), 'delete me')
    fs.writeFileSync(path.join(uploadDirectory, retainedPhoto), 'keep me')
    await pool.query('INSERT INTO photos (cleaning_id, storage_path) VALUES ($1, $2)', [deletionId, deletedPhoto])
    await pool.query('INSERT INTO photos (cleaning_id, storage_path) VALUES ($1, $2)', [id, retainedPhoto])
    await pool.query('INSERT INTO photos (cleaning_id, storage_path) VALUES ($1, $2)', [deletionId, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg'])
    assert.deepEqual(await deleteCleaning('invalid uuid'), { ok: false, error: 'validation' })
    assert.deepEqual(await deleteCleaning('99999999-9999-9999-9999-999999999999'), { ok: false, error: 'not_found' })
    assert.deepEqual(await deleteCleaning(deletionId), { ok: true })
    assert.equal((await pool.query('SELECT count(*)::int n FROM cleanings WHERE id = $1', [deletionId])).rows[0].n, 0)
    assert.equal((await pool.query('SELECT count(*)::int n FROM cleaning_services WHERE cleaning_id = $1', [deletionId])).rows[0].n, 0)
    assert.equal((await pool.query('SELECT count(*)::int n FROM client_rules WHERE cleaning_id = $1', [deletionId])).rows[0].n, 0)
    assert.equal((await pool.query('SELECT count(*)::int n FROM photos WHERE cleaning_id = $1', [deletionId])).rows[0].n, 0)
    assert.equal(fs.existsSync(path.join(uploadDirectory, deletedPhoto)), false)
    assert.equal(fs.existsSync(path.join(uploadDirectory, retainedPhoto)), true)
    assert.equal(await getCleaningDataByClientToken(deletionToken), null)
    assert.equal((await getCleanerCleanings()).some(cleaning => cleaning.id === deletionId), false)
    assert.deepEqual(await deleteCleaning(deletionId), { ok: false, error: 'not_found' })

    process.env.DATABASE_URL = ''
    assert.equal(getPostgresPool(), null)
    assert.deepEqual((await getCleaningData(id)).cleaning, mock.cleaning)
    assert.deepEqual((await getCleanerCleanings())[0], {
      id: mock.cleaning.id,
      number: mock.cleaning.number,
      clientName: mock.cleaning.client,
      address: mock.cleaning.address,
      startedAt: mock.cleaning.startedAt,
      status: mock.cleaning.status,
      completedAt: mock.cleaning.completedAt,
      acceptedAt: mock.cleaning.acceptedAt,
      progress: { done: 3, total: 8, percent: 38 },
    })
    assert.deepEqual(await updateChecklistItem(id, 's4', true), { ok: true })
    const mockCompletion = await completeCleaning(id)
    assert.equal(mockCompletion.ok, true)
    assert.ok(mockCompletion.completedAt)
    const mockLink = await getOrCreateClientLink(id)
    assert.equal(mockLink.ok, true)
    assert.match(mockLink.token, /^[A-Za-z0-9_-]{32}$/)
    assert.deepEqual(await getOrCreateClientLink(id), mockLink)
    assert.equal(await getCleaningDataByClientToken(mockLink.token), null)
    assert.deepEqual(await updateCleaningClient(id, {
      clientName: 'Мария',
      address: 'Москва',
    }), { ok: true })
    assert.equal((await acceptCleaning(id)).ok, true)
    assert.deepEqual(await acceptCleaning('99999999-9999-9999-9999-999999999999'), { ok: false })

    process.env.DATABASE_URL = url
    await pool.end()
    assert.deepEqual(await updateChecklistItem(id, itemId, true), { ok: false })
    assert.deepEqual(await completeCleaning(id), { ok: false })
    assert.deepEqual(await acceptCleaning(id), { ok: false })
    assert.deepEqual(await updateCleaningClient(id, {
      clientName: 'Мария',
      address: 'Москва',
    }), { ok: false })
    assert.deepEqual((await getCleaningData(id)).cleaning, mock.cleaning)
    console.log('PASS: seed, client details, share tokens, timestamps, completion and acceptance guards, locking, mock fallback and DB failures')
  } finally {
    if (!pool.ended) await pool.end()
    fs.rmSync(uploadDirectory, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
