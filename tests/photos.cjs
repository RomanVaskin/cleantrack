// Requires a disposable local DB initialized by tests/postgres.cjs.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const sharp = require('sharp')
const url = process.env.CLEANTRACK_TEST_DATABASE_URL
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Disposable LOCAL database required')
process.env.DATABASE_URL = url
process.env.DEMO_CLEANING_ID = '11111111-1111-1111-1111-111111111111'
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cleantrack-photos-test-'))
process.env.CLEANTRACK_UPLOAD_DIR = directory
const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {}
  if (id === 'next/server') return { connection: async () => {} }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename)
const { POST } = require('../app/api/photos/route.ts')
const { GET } = require('../app/api/photos/[id]/route.ts')
const { getPostgresPool } = require('../lib/db/postgres.ts')
const { getCleaningData } = require('../lib/data/cleanings.ts')
const id = process.env.DEMO_CLEANING_ID
const pool = getPostgresPool()
const created = []
const upload = (body, type, query = '', headers = {}) => POST(new Request(`http://localhost/api/photos${query}`, {
  method: 'POST', headers: { 'content-type': type, ...headers }, body,
}))
const read = photoId => GET(new Request('http://localhost'), { params: Promise.resolve({ id: photoId }) })
async function main() {
  try {
    const service = (await pool.query('SELECT id FROM cleaning_services WHERE cleaning_id = $1 LIMIT 1', [id])).rows[0].id
    const source = { create: { width: 3000, height: 1500, channels: 3, background: '#447799' } }
    const jpeg = await sharp(source).jpeg().toBuffer()
    const heic = fs.readFileSync(path.join(__dirname, 'fixtures/mobile.heic'))
    const fixtures = [
      ['image/jpeg', jpeg],
      ['image/png', await sharp(source).png().toBuffer()],
      ['image/webp', await sharp(source).webp().toBuffer()],
      ['image/heic', heic], ['image/heif', heic],
      ['image/avif', await sharp(source).avif().toBuffer()],
      ['', jpeg], ['application/octet-stream', heic], ['image/x-heic', heic],
      ['image/not-real', jpeg],
    ]
    for (const [type, bytes] of fixtures) {
      const response = await upload(bytes, type, type === 'image/png' ? `?cleaning_service_id=${service}` : '')
      assert.equal(response.status, 201)
      const photo = await response.json()
      created.push(photo.id)
      assert.equal(photo.cleaningServiceId, type === 'image/png' ? service : null)
      const stored = (await pool.query('SELECT storage_path FROM photos WHERE id = $1', [photo.id])).rows[0].storage_path
      assert.match(stored, /^[a-f0-9-]+\.jpg$/)
      const saved = fs.readFileSync(path.join(directory, stored))
      const metadata = await sharp(saved).metadata()
      assert.equal(metadata.format, 'jpeg')
      assert.ok(metadata.width <= 2400 && metadata.height <= 2400)
      await sharp(saved).raw().toBuffer()
      const fetched = await read(photo.id)
      assert.equal(fetched.status, 200)
      assert.equal(fetched.headers.get('content-type'), 'image/jpeg')
      assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), saved)
      // Each page reads this same request-time data after reload.
      for (let reload = 0; reload < 2; reload++) assert.ok((await getCleaningData(id)).photos.some(p => p.id === photo.id))
      if (type === 'image/png') assert.equal((await getCleaningData(id)).checklist.find(i => i.id === service).photo.id, photo.id)
    }
    for (const type of ['image/heic', 'image/heif']) {
      assert.equal((await upload('bad', type)).status, 415)
      assert.equal((await upload(Buffer.alloc(50 * 1024 * 1024 + 1), type)).status, 413)
    }
    assert.equal((await upload('bad', 'image/svg+xml')).status, 415)
    assert.equal((await upload('bad', 'image/jpeg')).status, 415)
    assert.equal((await upload(Buffer.alloc(50 * 1024 * 1024 + 1), 'image/png')).status, 413)
    assert.equal((await upload('small', 'image/png', '', { 'content-length': String(50 * 1024 * 1024 + 1) })).status, 413)
    assert.equal((await upload(fixtures[0][1], 'image/jpeg', '?cleaning_service_id=99999999-9999-9999-9999-999999999999')).status, 400)
    // Signatures alone are insufficient; full decoding must succeed.
    assert.equal((await upload(Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'), 'image/jpeg')).status, 415)
    const rotated = await sharp({ create: { width: 40, height: 20, channels: 3, background: 'red' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const rotatedResponse = await upload(rotated, '')
    assert.equal(rotatedResponse.status, 201)
    const rotatedPhoto = await rotatedResponse.json()
    created.push(rotatedPhoto.id)
    const rotatedRead = await read(rotatedPhoto.id)
    assert.equal(rotatedRead.status, 200)
    const rotatedMeta = await sharp(Buffer.from(await rotatedRead.arrayBuffer())).metadata()
    assert.equal(rotatedMeta.width, 20)
    assert.equal(rotatedMeta.height, 40)
    assert.equal(rotatedMeta.orientation, undefined)
    // Legacy stored PNG/WebP remain readable through the same route.
    for (const extension of ['png', 'webp']) {
      const legacy = `44444444-4444-4444-4444-444444444444.${extension}`
      const bytes = await sharp(source)[extension]().toBuffer()
      fs.writeFileSync(path.join(directory, legacy), bytes)
      await pool.query('UPDATE photos SET storage_path = $2 WHERE id = $1', [created[0], legacy])
      const response = await read(created[0])
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), `image/${extension}`)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
    }
    assert.equal((await read('../README.md')).status, 404)
    assert.equal((await read('99999999-9999-9999-9999-999999999999')).status, 404)
    const photoId = created[0]
    for (const malicious of ['../README.md', '/etc/passwd', 'missing.jpg']) {
      await pool.query('UPDATE photos SET storage_path = $2 WHERE id = $1', [photoId, malicious])
      assert.equal((await read(photoId)).status, 404)
    }
    const symlink = '22222222-2222-2222-2222-222222222222.jpg'
    fs.symlinkSync(path.join(__dirname, '../README.md'), path.join(directory, symlink))
    await pool.query('UPDATE photos SET storage_path = $2 WHERE id = $1', [photoId, symlink])
    assert.equal((await read(photoId)).status, 404)
    await pool.query('UPDATE photos SET storage_path = $2 WHERE id = $1', [photoId, '33333333-3333-3333-3333-333333333333.png'])
    assert.equal((await read(photoId)).status, 404)
    const originalQuery = pool.query
    const originalError = console.error
    const logs = []
    try {
      console.error = (...args) => logs.push(args)
      pool.query = async () => { throw Object.assign(new Error('postgresql://user:SECRET@example/file-content'), { code: 'ECONNREFUSED' }) }
      const failed = await upload(fixtures[0][1], 'image/jpeg')
      assert.equal(failed.status, 400)
      assert.deepEqual(await failed.json(), { error: 'Не удалось загрузить фото' })
      assert.match(JSON.stringify(logs), /ECONNREFUSED/)
      assert.doesNotMatch(JSON.stringify(logs), /SECRET|file-content|postgresql/)
    } finally {
      pool.query = originalQuery
      console.error = originalError
    }
    const before = fs.readdirSync(directory)
    process.env.DATABASE_URL = ''
    assert.equal((await upload(fixtures[0][1], 'image/jpeg')).status, 400)
    assert.deepEqual(fs.readdirSync(directory), before)
    assert.ok((await getCleaningData(id)).photos.every(p => p.src.startsWith('/photos/')))
    assert.equal((await read(created[1])).status, 404)
    console.log('PASS: JPEG/PNG/WebP/HEIC/HEIF/AVIF, normalization, EXIF rotation, legacy reads, metadata, service binding, reload reads, MIME-independent detection, size/invalid-image rejection, traversal/symlink/missing-file protection, mock fallback')
  } finally {
    await pool.query('DELETE FROM photos WHERE id = ANY($1::uuid[])', [created])
    await pool.end()
    fs.rmSync(directory, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
