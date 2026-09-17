export type Service = {
  id: string
  label: string
  /** Входит ли услуга в эту уборку (выбрана клиентом/менеджером) */
  included: boolean
  done: boolean
  photo?: string | null
  note?: string
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

export const initialServices: Service[] = [
  { id: 's1', label: 'Влажная уборка квартиры', included: true, done: true },
  { id: 's2', label: 'Стирка вещей', included: true, done: true },
  { id: 's3', label: 'Глажка вещей', included: true, done: true },
  { id: 's4', label: 'Сложить вещи в шкафах / гардеробной', included: true, done: false, note: 'Сложить по полкам, как было' },
  { id: 's5', label: 'Уборка полок внутри шкафов', included: true, done: false },
  { id: 's6', label: 'Разложить / организовать вещи в шкафах', included: false, done: false },
  { id: 's7', label: 'Мойка окон', included: true, done: false, photo: null },
  { id: 's8', label: 'Удаление сложных пятен: диваны / кресла', included: true, done: false },
  { id: 's9', label: 'Удаление сложных пятен: ковры', included: false, done: false },
  { id: 's10', label: 'Удаление сложных пятен: пол', included: true, done: false },
  { id: 's11', label: 'Удаление сложных пятен: мебель / фасады шкафов', included: false, done: false },
  { id: 's12', label: 'Отнести / забрать вещи из химчистки', included: false, done: false },
]

export type CabinetRule = 'all' | 'selected' | 'none'
export type MoveRule = 'return' | 'agree' | 'none'

export const cabinetOptions: Record<CabinetRule, string> = {
  all: 'Да, все',
  selected: 'Только указанные клиентом',
  none: 'Нет',
}

export const moveOptions: Record<MoveRule, string> = {
  return: 'Да, с возвращением на место',
  agree: 'Только после согласования',
  none: 'Нет',
}

export const clientRules = {
  cabinets: 'selected' as CabinetRule,
  moveItems: 'agree' as MoveRule,
  doNotTouch: 'Документы на рабочем столе, ноутбук, картины',
  wishes: 'В детской использовать только средство клиента',
}

export function countProgress(services: Service[]) {
  const active = services.filter((s) => s.included)
  const total = active.length
  const done = active.filter((s) => s.done).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { total, done, percent }
}
