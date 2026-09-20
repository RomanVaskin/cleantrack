const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')
const mod = new Module(__filename)
mod._compile(ts.transpileModule(fs.readFileSync(require.resolve('../lib/photo-upload.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, __filename)
const { uploadCleaningPhoto, MAX_PHOTO_BYTES } = mod.exports
const cleaningId = '11111111-1111-1111-1111-111111111111'
async function main() {
  assert.equal(MAX_PHOTO_BYTES, 50 * 1024 * 1024)
  let calls = 0
  global.fetch = async (url, options) => {
    calls++
    assert.equal(url, `/api/photos?cleaning_id=${cleaningId}`)
    assert.equal(options.body, selected)
    return Response.json({ id: 'photo' }, { status: 201 })
  }
  let selected
  for (const type of ['', 'application/octet-stream', 'image/x-heic', 'image/avif']) {
    selected = new File(['image bytes'], '../../photo.heic', { type })
    assert.deepEqual(await uploadCleaningPhoto(selected, cleaningId, null), { id: 'photo' })
  }
  assert.equal(calls, 4)
  global.fetch = async (url, options) => {
    calls++
    assert.equal(url, `/api/photos?cleaning_id=${cleaningId}&cleaning_service_id=22222222-2222-2222-2222-222222222201`)
    assert.equal(options.body, selected)
    return Response.json({ id: 'photo' }, { status: 201 })
  }
  assert.deepEqual(await uploadCleaningPhoto(selected, cleaningId, '22222222-2222-2222-2222-222222222201'), { id: 'photo' })
  assert.equal(calls, 5)
  global.fetch = async (url, options) => {
    calls++
    assert.equal(url, `/api/photos?cleaning_id=${cleaningId}&section_code=kitchen`)
    assert.equal(options.body, selected)
    return Response.json({ id: 'photo' }, { status: 201 })
  }
  assert.deepEqual(await uploadCleaningPhoto(selected, cleaningId, null, 'kitchen'), { id: 'photo' })
  assert.equal(calls, 6)
  await assert.rejects(uploadCleaningPhoto({ size: MAX_PHOTO_BYTES + 1 }, cleaningId, null), /Фото слишком большое/)
  assert.equal(calls, 6)
  for (const [status, message] of [[413, 'Фото слишком большое'], [415, 'Формат фото не поддерживается'], [500, 'Не удалось загрузить фото']]) {
    global.fetch = async () => new Response('', { status })
    await assert.rejects(uploadCleaningPhoto(selected, cleaningId, null), { message })
  }
  console.log('PASS: client accepts unknown MIME, enforces size, and maps upload errors')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
