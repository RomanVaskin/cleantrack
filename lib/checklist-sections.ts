import type { ChecklistItem, Photo, SectionCode } from './types'

export const SECTION_ORDER: SectionCode[] = ['rooms', 'kitchen', 'bathroom', 'completion']

export const SECTION_TITLES: Record<SectionCode, string> = {
  rooms: 'Во всех комнатах',
  kitchen: 'Кухня',
  bathroom: 'Санузел',
  completion: 'Завершение',
}

export function isSectionCode(value: string | null | undefined): value is SectionCode {
  return value != null && (SECTION_ORDER as string[]).includes(value)
}

export interface ChecklistSection {
  code: SectionCode
  title: string
  items: ChecklistItem[]
  photos: Photo[]
  done: number
  total: number
  percent: number
}

/** Groups included checklist items and their section-level photos by fixed section order. */
export function groupIntoSections(checklist: ChecklistItem[], photos: Photo[]): ChecklistSection[] {
  const sections: ChecklistSection[] = []
  for (const code of SECTION_ORDER) {
    const items = checklist.filter((item) => item.sectionCode === code && item.included)
    if (items.length === 0) continue
    const done = items.filter((item) => item.done).length
    const total = items.length
    sections.push({
      code,
      title: SECTION_TITLES[code],
      items,
      photos: photos.filter((photo) => photo.sectionCode === code),
      done,
      total,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    })
  }
  return sections
}

/** Included checklist items outside the fixed sections: legacy items and add-on services. */
export function ungroupedItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.sectionCode == null && item.included)
}

/** Same photo records, reordered rooms→kitchen→bathroom→completion, then everything else. */
export function aggregateGalleryPhotos(sections: ChecklistSection[], photos: Photo[]): Photo[] {
  const sectioned = new Set(sections.flatMap((section) => section.photos.map((photo) => photo.id)))
  const rest = photos.filter((photo) => !sectioned.has(photo.id))
  return [...sections.flatMap((section) => section.photos), ...rest]
}
