export type CleaningStatus = 'in_progress' | 'completed'

export type CabinetRule = 'all' | 'selected' | 'none'
export type MoveRule = 'return' | 'agree' | 'none'

/** Уборка — единица работы, привязанная к клиенту и адресу */
export interface Cleaning {
  id: string
  number: string
  address: string
  client: string
  startedAt: string
  status: CleaningStatus
}

/** Каталог услуг, которые в принципе может включать уборка */
export interface Service {
  id: string
  label: string
}

export interface Photo {
  src: string
  alt: string
}

/**
 * Пункт чек-листа конкретной уборки: состояние услуги (service)
 * в рамках этой уборки — выбрана ли, выполнена ли, фото, примечание.
 */
export interface ChecklistItem {
  id: string
  serviceId: string
  label: string
  included: boolean
  done: boolean
  photo: Photo | null
  note?: string
}

export interface ClientRules {
  cabinets: CabinetRule
  moveItems: MoveRule
  doNotTouch: string
  wishes: string
}
