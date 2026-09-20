const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id.startsWith('@/')) id = require('node:path').resolve(__dirname, '..', id.slice(2))
  return originalLoad.call(this, id, parent, isMain)
}
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename)
}

const {
  SECTION_ORDER,
  SECTION_TITLES,
  isSectionCode,
  groupIntoSections,
  ungroupedItems,
  aggregateGalleryPhotos,
} = require('../lib/checklist-sections.ts')

function item(id, sectionCode, overrides = {}) {
  return {
    id, serviceId: id, label: `label-${id}`, included: true, done: false,
    photo: null, sectionCode, ...overrides,
  }
}

function photo(id, overrides = {}) {
  return { id, src: `/api/photos/${id}`, alt: 'Фото уборки', cleaningServiceId: null, sectionCode: null, ...overrides }
}

function main() {
  assert.deepEqual(SECTION_ORDER, ['rooms', 'kitchen', 'bathroom', 'completion'])
  assert.equal(Object.keys(SECTION_TITLES).length, 4)
  assert.equal(isSectionCode('kitchen'), true)
  assert.equal(isSectionCode('garage'), false)
  assert.equal(isSectionCode(null), false)
  assert.equal(isSectionCode(undefined), false)

  // A cleaning with only legacy/add-on services (no sectionCode) groups into zero sections.
  const legacyChecklist = [
    item('l1', null),
    item('l2', null, { done: true }),
    item('l3', null, { included: false }),
  ]
  assert.deepEqual(groupIntoSections(legacyChecklist, []), [])
  assert.deepEqual(ungroupedItems(legacyChecklist).map((i) => i.id), ['l1', 'l2'])

  // A new base cleaning: 8 rooms / 8 kitchen / 6 bathroom / 3 completion, plus one add-on.
  const rooms = Array.from({ length: 8 }, (_, i) => item(`rooms-${i}`, 'rooms', { done: i < 5 }))
  const kitchen = Array.from({ length: 8 }, (_, i) => item(`kitchen-${i}`, 'kitchen', { done: i < 8 }))
  const bathroom = Array.from({ length: 6 }, (_, i) => item(`bathroom-${i}`, 'bathroom', { done: false }))
  const completion = Array.from({ length: 3 }, (_, i) => item(`completion-${i}`, 'completion', { done: false }))
  const addon = item('addon-1', null, { done: true })
  const excludedAddon = item('addon-2', null, { included: false })
  const checklist = [...rooms, ...kitchen, ...bathroom, ...completion, addon, excludedAddon]

  const sectionPhotos = [
    photo('p-rooms-1', { sectionCode: 'rooms' }),
    photo('p-rooms-2', { sectionCode: 'rooms' }),
    photo('p-kitchen-1', { sectionCode: 'kitchen' }),
    photo('p-item-1', { cleaningServiceId: 'rooms-0' }), // item-level photo: must NOT land in any section
    photo('p-general-1'), // fully general photo: must NOT land in any section
  ]

  const sections = groupIntoSections(checklist, sectionPhotos)
  assert.equal(sections.length, 4)
  assert.deepEqual(sections.map((s) => s.code), ['rooms', 'kitchen', 'bathroom', 'completion'])
  assert.deepEqual(sections.map((s) => s.title), [
    'Во всех комнатах', 'Кухня', 'Санузел', 'Завершение',
  ])
  assert.deepEqual(sections.map((s) => s.total), [8, 8, 6, 3])
  assert.deepEqual(sections.map((s) => s.done), [5, 8, 0, 0])
  assert.equal(sections[1].percent, 100) // kitchen: 8/8 done
  assert.equal(sections[0].percent, 63) // rooms: 5/8 done → round(62.5) = 63

  const roomsSection = sections[0]
  assert.equal(roomsSection.items.length, 8)
  assert.deepEqual(roomsSection.photos.map((p) => p.id), ['p-rooms-1', 'p-rooms-2'])
  const kitchenSection = sections[1]
  assert.deepEqual(kitchenSection.photos.map((p) => p.id), ['p-kitchen-1'])
  // Sections never mix photos, and item-level/general photos never leak into a section.
  assert.deepEqual(sections[2].photos, [])
  assert.deepEqual(sections[3].photos, [])

  // Excluded (not-included) add-on items never appear anywhere.
  const addons = ungroupedItems(checklist)
  assert.deepEqual(addons.map((i) => i.id), ['addon-1'])

  // Aggregate gallery: section photos first in fixed section order, then the rest,
  // and every photo record appears exactly once (no duplication of the physical file).
  const allPhotos = [...sectionPhotos]
  const aggregate = aggregateGalleryPhotos(sections, allPhotos)
  assert.deepEqual(aggregate.map((p) => p.id), ['p-rooms-1', 'p-rooms-2', 'p-kitchen-1', 'p-item-1', 'p-general-1'])
  assert.equal(new Set(aggregate.map((p) => p.id)).size, aggregate.length)
  assert.equal(aggregate.length, allPhotos.length)

  console.log('PASS: section grouping, done/total per section, section photo isolation, ungrouped add-ons, aggregate gallery ordering')
}

main()
