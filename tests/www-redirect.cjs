const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

async function main() {
  const config = (await import(pathToFileURL(path.resolve(__dirname, '../next.config.mjs')).href)).default
  const redirects = await config.redirects()
  assert.equal(redirects.length, 1)
  const [rule] = redirects

  // A 301 (not Next's 308 `permanent`) from every www path to the same path on the canonical host.
  assert.equal(rule.statusCode, 301)
  assert.equal(rule.permanent, undefined)
  assert.equal(rule.source, '/:path*')
  assert.equal(rule.destination, 'https://cleantrack.ru/:path*')
  assert.deepEqual(rule.has.map((h) => h.type), ['host'])

  // Only the www host matches; the canonical host never does, so there is no redirect loop.
  const host = new RegExp(`^${rule.has[0].value}$`)
  assert.equal(host.test('www.cleantrack.ru'), true)
  for (const other of ['cleantrack.ru', 'wwwxcleantrack.ru', 'www.cleantrack.ru.evil.com', 'localhost:3000']) {
    assert.equal(host.test(other), false, other)
  }
  assert.equal(new URL(rule.destination.replace(':path*', '')).host, 'cleantrack.ru')

  // The private-route headers are unchanged.
  assert.ok((await config.headers()).length > 0)

  console.log('PASS: www.cleantrack.ru → https://cleantrack.ru 301 rule, canonical host never matched')
}

main().catch((error) => { console.error(error); process.exit(1) })
