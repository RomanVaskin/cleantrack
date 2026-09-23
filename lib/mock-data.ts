import type {
  CabinetRule,
  ChecklistItem,
  Cleaning,
  ClientRules,
  MoveRule,
  Photo,
  Service,
} from './types'

export type { CabinetRule, ChecklistItem, Cleaning, ClientRules, MoveRule, Photo, Service }

export const cleaning: Cleaning = {
  id: '11111111-1111-1111-1111-111111111111',
  number: '124',
  address: 'Москва, ул. Ленина, 15',
  client: 'Анна',
  clientPhone: null,
  startedAt: '2026-01-15T11:05:00.000Z',
  status: 'in_progress',
  completedAt: null,
  acceptedAt: null,
  clientToken: null,
  photoReportEnabled: false,
  requestedDate: null,
  requestedTime: null,
}

export const photos: Photo[] = [
  { src: '/photos/kitchen.png', alt: 'Кухня после уборки' },
  { src: '/photos/sink.png', alt: 'Раковина и зеркало' },
  { src: '/photos/room.png', alt: 'Комната после уборки' },
]

/** Каталог услуг, которые может включать в себя уборка */
export const services: Service[] = [
  { id: 's1', label: 'Влажная уборка квартиры' },
  { id: 's2', label: 'Стирка вещей' },
  { id: 's3', label: 'Глажка вещей' },
  { id: 's4', label: 'Сложить вещи в шкафах / гардеробной' },
  { id: 's5', label: 'Уборка полок внутри шкафов' },
  { id: 's6', label: 'Разложить / организовать вещи в шкафах' },
  { id: 's7', label: 'Мойка окон' },
  { id: 's8', label: 'Удаление сложных пятен: диваны / кресла' },
  { id: 's9', label: 'Удаление сложных пятен: ковры' },
  { id: 's10', label: 'Удаление сложных пятен: пол' },
  { id: 's11', label: 'Удаление сложных пятен: мебель / фасады шкафов' },
  { id: 's12', label: 'Отнести / забрать вещи из химчистки' },
  { id: 's13', label: 'Генеральная уборка' },
]

/** Состояние чек-листа этой конкретной уборки, по услугам из каталога */
const checklistSeed: Array<Pick<ChecklistItem, 'serviceId' | 'included' | 'done' | 'note'>> = [
  { serviceId: 's1', included: true, done: true },
  { serviceId: 's2', included: true, done: true },
  { serviceId: 's3', included: true, done: true },
  { serviceId: 's4', included: true, done: false, note: 'Сложить по полкам, как было' },
  { serviceId: 's5', included: true, done: false },
  { serviceId: 's6', included: false, done: false },
  { serviceId: 's7', included: true, done: false },
  { serviceId: 's8', included: true, done: false },
  { serviceId: 's9', included: false, done: false },
  { serviceId: 's10', included: true, done: false },
  { serviceId: 's11', included: false, done: false },
  { serviceId: 's12', included: false, done: false },
]

/**
 * Собирает чек-лист уборки, соединяя каталог услуг с их состоянием.
 * В будущем заменяется на запрос к бэкенду с той же сигнатурой.
 */
export function getInitialChecklist(): ChecklistItem[] {
  return checklistSeed.map((entry) => {
    const service = services.find((s) => s.id === entry.serviceId)
    return {
      id: entry.serviceId,
      serviceId: entry.serviceId,
      label: service?.label ?? '',
      included: entry.included,
      done: entry.done,
      photo: null,
      note: entry.note,
    }
  })
}

export const cabinetOptions: Record<CabinetRule, string> = {
  all: 'Да',
  selected: 'Только указанные клиентом',
  none: 'Нет',
}

export const moveOptions: Record<MoveRule, string> = {
  return: 'Да',
  agree: 'Только после согласования',
  none: 'Нет',
}

export const clientRules: ClientRules = {
  cabinets: 'none',
  moveItems: 'none',
  doNotTouch: '',
  wishes: '',
}

export function countProgress(items: ChecklistItem[]) {
  const active = items.filter((i) => i.included)
  const total = active.length
  const done = active.filter((i) => i.done).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { total, done, percent }
}
