export type ChecklistItem = {
  id: string
  label: string
  done: boolean
  photoRequired?: boolean
  photo?: string | null
}

export type Zone = {
  id: string
  title: string
  items: ChecklistItem[]
}

export const cleaning = {
  number: 124,
  address: 'Москва, ул. Ленина, 15',
  client: 'Анна',
  startedAt: '14:05',
}

export const photos = [
  { src: '/photos/kitchen.png', alt: 'Кухня после уборки' },
  { src: '/photos/sink.png', alt: 'Раковина и зеркало' },
  { src: '/photos/room.png', alt: 'Комната после уборки' },
]

export const initialZones: Zone[] = [
  {
    id: 'kitchen',
    title: 'Кухня',
    items: [
      { id: 'k1', label: 'Протереть рабочие поверхности', done: true },
      { id: 'k2', label: 'Помыть раковину', done: true },
      { id: 'k3', label: 'Протереть фасады', done: true },
      { id: 'k4', label: 'Очистить плиту', done: false, photoRequired: true, photo: null },
      { id: 'k5', label: 'Помыть пол', done: false },
    ],
  },
  {
    id: 'bath',
    title: 'Санузел',
    items: [
      { id: 'b1', label: 'Раковина', done: true },
      { id: 'b2', label: 'Зеркало', done: true },
      { id: 'b3', label: 'Унитаз', done: false },
      { id: 'b4', label: 'Душевая', done: false, photoRequired: true, photo: null },
      { id: 'b5', label: 'Пол', done: false },
    ],
  },
  {
    id: 'room',
    title: 'Комната',
    items: [
      { id: 'r1', label: 'Удалить пыль', done: true },
      { id: 'r2', label: 'Пропылесосить', done: false },
      { id: 'r3', label: 'Помыть пол', done: false },
    ],
  },
]

export function countProgress(zones: Zone[]) {
  const items = zones.flatMap((z) => z.items)
  const total = items.length
  const done = items.filter((i) => i.done).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { total, done, percent }
}
