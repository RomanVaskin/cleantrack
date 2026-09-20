export type CleaningStatus = 'in_progress' | 'completed' | 'accepted'

export type CabinetRule = 'all' | 'selected' | 'none'
export type MoveRule = 'return' | 'agree' | 'none'

/** Fixed base-cleaning checklist sections; photos and items group under these. */
export type SectionCode = 'rooms' | 'kitchen' | 'bathroom' | 'completion'

/** Уборка — единица работы, привязанная к клиенту и адресу */
export interface Cleaning {
  id: string
  number: string
  address: string
  client: string
  clientPhone: string | null
  startedAt: string
  status: CleaningStatus
  completedAt: string | null
  acceptedAt: string | null
  clientToken: string | null
  photoReportEnabled: boolean
  requestedDate: string | null
  requestedTime: string | null
}

/** Каталог услуг, которые в принципе может включать уборка */
export interface Service {
  id: string
  label: string
}

export interface Photo {
  id?: string
  cleaningServiceId?: string | null
  /** Set for a base-cleaning section photo; mutually exclusive with cleaningServiceId. */
  sectionCode?: SectionCode | null
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
  /** Non-null for base-cleaning items; null for the flat add-on catalog. */
  sectionCode?: SectionCode | null
}

export interface ClientRules {
  cabinets: CabinetRule
  moveItems: MoveRule
  doNotTouch: string
  wishes: string
}
