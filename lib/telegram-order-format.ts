export const ANY_TIME = 'Время не важно'

export const TIME_INTERVALS = [
  '09:00–12:00',
  '12:00–15:00',
  '15:00–18:00',
  '18:00–21:00',
] as const

export type CabinetRule = 'all' | 'selected' | 'none'
export type PersonalItemsRule = 'return' | 'agree' | 'none'

const cabinetLabels: Record<CabinetRule, string> = {
  all: 'да',
  selected: 'только указанные клиентом',
  none: 'нет',
}

const personalItemsLabels: Record<PersonalItemsRule, string> = {
  return: 'да',
  agree: 'только после согласования',
  none: 'нет',
}

export interface OrderRules {
  cabinetsRule?: CabinetRule | null
  personalItemsRule?: PersonalItemsRule | null
  doNotTouch?: string | null
}

export function normalizeCustomTimeInterval(value: string): string | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})\s*[-–—]\s*(\d{2}):(\d{2})$/)
  if (!match) return null

  const [, startHours, startMinutes, endHours, endMinutes] = match
  const parts = [startHours, startMinutes, endHours, endMinutes].map(Number)
  const [startHour, startMinute, endHour, endMinute] = parts
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null

  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  if (end <= start) return null

  return `${startHours}:${startMinutes}–${endHours}:${endMinutes}`
}

export function normalizeRequestedDate(value: string, today = new Date()): string | null {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null
  const [, dayText, monthText, yearText] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null

  const todayParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(today)
  const todayPart = (type: Intl.DateTimeFormatPartTypes) => todayParts.find((part) => part.type === type)?.value ?? ''
  const todayIso = `${todayPart('year')}-${todayPart('month')}-${todayPart('day')}`
  const iso = `${yearText}-${monthText}-${dayText}`
  return iso >= todayIso ? iso : null
}

export function formatRequestedDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value
}

export function postgresDateToIso(value: string | Date | null): string | null {
  if (!(value instanceof Date)) return value
  const year = String(value.getFullYear()).padStart(4, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function hasSpecialRules(rules: OrderRules): boolean {
  return rules.cabinetsRule !== undefined && rules.cabinetsRule !== null && rules.cabinetsRule !== 'none'
    || rules.personalItemsRule !== undefined && rules.personalItemsRule !== null && rules.personalItemsRule !== 'none'
    || Boolean(rules.doNotTouch?.trim())
}

export function formatRules(rules: OrderRules): string[] {
  if (!hasSpecialRules(rules)) return ['Правила клиента: особых правил нет']
  return [
    'Правила клиента:',
    `Шкафы: ${cabinetLabels[rules.cabinetsRule ?? 'none']}`,
    `Личные вещи: ${personalItemsLabels[rules.personalItemsRule ?? 'none']}`,
    `Не трогать: ${rules.doNotTouch?.trim() || 'ничего'}`,
  ]
}
