// Static marketing content + pure pricing math for the "/" landing page only. No DB, no API,
// no `server-only` import: this has to run in the browser (the price quiz is client-side).
// The checklist text below mirrors db/migrations/009_seed_base_cleaning_checklist.sql so the
// landing page shows the real base-cleaning scope instead of invented marketing copy — it is a
// static copy for display, not a second source of truth: nothing here is read by the tracker.

export const TELEGRAM_CONTACT_URL = 'https://t.me/CleanTrackRuBot'

export type HomeChecklistGroup = { title: string; items: string[] }

export const HOME_CHECKLIST_GROUPS: HomeChecklistGroup[] = [
  {
    title: 'Во всех комнатах',
    items: [
      'Удалить пыль с доступных поверхностей',
      'Протереть подоконники',
      'Пропылесосить полы и ковры',
      'Вымыть полы',
      'Протереть зеркала и стеклянные поверхности',
      'Собрать и вынести мусор',
      'Аккуратно расставить предметы на их местах',
      'Сменить постельное бельё',
    ],
  },
  {
    title: 'Кухня',
    items: [
      'Протереть рабочие поверхности',
      'Очистить мойку и смеситель',
      'Протереть фасады кухни снаружи',
      'Протереть плиту / варочную поверхность',
      'Протереть бытовую технику снаружи',
      'Убрать холодильник внутри',
      'Убрать духовку внутри',
      'Вымыть пол',
    ],
  },
  {
    title: 'Санузел',
    items: [
      'Вымыть раковину и смеситель',
      'Очистить ванну / душевую',
      'Очистить унитаз',
      'Протереть зеркала',
      'Протереть доступные поверхности',
      'Вымыть пол',
    ],
  },
  {
    title: 'Завершение',
    items: [
      'Проверить качество уборки',
      'Проверить свет, воду и окна',
      'Сделать фотоотчёт, если заказан',
    ],
  },
]

export const HOW_IT_WORKS_STEPS = [
  { title: 'Оформляете заказ', text: 'Через сайт или Telegram' },
  { title: 'Назначаем клинера', text: 'Вы получаете персональную ссылку' },
  { title: 'Следите за уборкой', text: 'Статус, чек-лист и фото' },
  { title: 'Принимаете результат', text: 'Всё видно в одном месте' },
]

export const DIFFERENCE_PLAIN = ['Заказали', 'Клинер приехал', 'Через несколько часов «готово»']

export const DIFFERENCE_CLEANTRACK = [
  'Текущий статус уборки',
  'Чек-лист выполненных работ',
  'Правила клиента учтены',
  'Фотоотчёт по комнатам',
  'Контроль результата перед оплатой',
]

export const TRUST_POINTS = [
  'Понятный чек-лист вместо «на глаз»',
  'Персональные правила клиента',
  'Фотоотчёт по комнатам',
  'Прозрачный статус уборки',
  'Принятие результата перед оплатой',
  'Заказ без звонков — через сайт или Telegram',
]

// Example instance of the real ClientRules shape (lib/types.ts) for the tracker showcase —
// option labels copied verbatim from lib/mock-data.ts (cabinetOptions / moveOptions) so the
// mockup reads exactly like the real client tracker, not invented UI copy.
export const RULES_PREVIEW = {
  cabinets: 'Только указанные клиентом',
  moveItems: 'Только после согласования',
  doNotTouch: 'Не трогать растения',
  wishes: 'Не трогать растения. Окна снаружи не мыть.',
}

// --- Price quiz -------------------------------------------------------------------------------
// Hardcoded, frontend-only pricing for the quiz prototype. Deliberately NOT derived from any
// backend/pricing table: no such pricing logic exists elsewhere in the app to reuse, and this
// patch does not introduce one (per task scope — no new backend, no new order system).

export type RoomOption = { rooms: number; label: string; areaLabel: string; price: number }
export const ROOM_OPTIONS: RoomOption[] = [
  { rooms: 1, label: '1 комната', areaLabel: 'до 45 м²', price: 4000 },
  { rooms: 2, label: '2 комнаты', areaLabel: 'до 75 м²', price: 4500 },
  { rooms: 3, label: '3 комнаты', areaLabel: 'до 100 м²', price: 5000 },
  { rooms: 4, label: '4 комнаты', areaLabel: '', price: 5500 },
]

export type CleaningType = 'basic' | 'general'
export const CLEANING_TYPES: { value: CleaningType; label: string; extra: number }[] = [
  { value: 'basic', label: 'Базовая', extra: 0 },
  { value: 'general', label: 'Генеральная', extra: 2000 },
]

export type ExtraOption = { id: string; label: string; unitLabel: string; price: number }
export const EXTRA_OPTIONS: ExtraOption[] = [
  { id: 'windows', label: 'Окна', unitLabel: '₽ / окно', price: 800 },
  { id: 'ironing', label: 'Глажка', unitLabel: '₽ / час', price: 800 },
  { id: 'balcony', label: 'Балкон / лоджия', unitLabel: '₽', price: 1000 },
]

export type DateOption = 'today' | 'tomorrow' | 'custom'
export const DATE_OPTIONS: { value: DateOption; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'custom', label: 'Выбрать дату' },
]

export type TimeOption = '09-12' | '12-15' | '15-18' | '18-21' | 'custom' | 'any'
export const TIME_OPTIONS: { value: TimeOption; label: string }[] = [
  { value: '09-12', label: '09:00–12:00' },
  { value: '12-15', label: '12:00–15:00' },
  { value: '15-18', label: '15:00–18:00' },
  { value: '18-21', label: '18:00–21:00' },
  { value: 'custom', label: 'Своё время' },
  { value: 'any', label: 'Время не важно' },
]

export type QuizSelection = {
  rooms: RoomOption | null
  cleaningType: CleaningType
  extraCounts: Record<string, number>
}

/** Pure total: room base price + cleaning-type surcharge + extras × their count. No rounding tricks. */
export function calculateQuizPrice(selection: QuizSelection): number {
  if (!selection.rooms) return 0
  const typeExtra = CLEANING_TYPES.find((t) => t.value === selection.cleaningType)?.extra ?? 0
  const extrasTotal = EXTRA_OPTIONS.reduce(
    (sum, extra) => sum + extra.price * (selection.extraCounts[extra.id] ?? 0),
    0,
  )
  return selection.rooms.price + typeExtra + extrasTotal
}

export function formatRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`
}
