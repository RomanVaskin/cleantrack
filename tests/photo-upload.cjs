const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')
const mod = new Module(__filename)
mod._compile(ts.transpileModule(fs.readFileSync(require.resolve('../lib/photo-upload.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, __filename)
const { uploadCleaningPhoto, MAX_PHOTO_BYTES } = mod.exports
async function main() {
  assert.equal(MAX_PHOTO_BYTES, 50 * 1024 * 1024)
  let calls = 0
  global.fetch = async (url, options) => {
    calls++
    assert.equal(options.body, selected)
    return Response.json({ id: 'photo' }, { status: 201 })
  }
  let selected
  for (const type of ['', 'application/octet-stream', 'image/x-heic', 'image/avif']) {
    selected = new File(['image bytes'], '../../photo.heic', { type })
    assert.deepEqual(await uploadCleaningPhoto(selected, null), { id: 'photo' })
  }
  assert.equal(calls, 4)
  await assert.rejects(uploadCleaningPhoto({ size: MAX_PHOTO_BYTES + 1 }, null), /Фото слишком большое/)
  assert.equal(calls, 4)
  for (const [status, message] of [[413, 'Фото слишком большое'], [415, 'Формат фото не поддерживается'], [500, 'Не удалось загрузить фото']]) {
    global.fetch = async () => new Response('', { status })
    await assert.rejects(uploadCleaningPhoto(selected, null), { message })
  }
  console.log('PASS: client accepts unknown MIME, enforces size, and maps upload errors')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
