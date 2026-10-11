// The body CleanTrack sends to the shared OLNOO CRM (`POST /api/leads/inbound`) for a confirmed
// Telegram order. Pure and `@/`-free (same split as DriveSet's lib/lead-crm-payload.ts) so it can
// be tested without a DB or network. CleanTrack's own `orders` row stays the source of truth —
// this only carries commercially useful context into the CRM lead, never a copy of the order.

export type CrmSyncOrder = {
  id: string
  number: string
  clientName: string
  clientPhone: string
  rooms: number
  windowsCount: number
  ironingHours: number
  balcony: boolean
  generalCleaning: boolean
  otherRequest: string | null
  totalPrice: number
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU').format(price).replace(/ /g, ' ')
}

function roomLabel(rooms: number): string {
  return `${rooms} ${rooms === 1 ? 'комната' : 'комнаты'}`
}

function orderMessage(order: CrmSyncOrder): string {
  const lines = [`Заказ CleanTrack: ${order.number}`, roomLabel(order.rooms)]
  if (order.windowsCount) lines.push(`Окна: ${order.windowsCount}`)
  if (order.ironingHours) lines.push(`Глажка: ${order.ironingHours} ч`)
  if (order.balcony) lines.push('Балкон / лоджия')
  if (order.generalCleaning) lines.push('Генеральная уборка')
  if (order.otherRequest) lines.push(`Дополнительно: ${order.otherRequest}`)
  lines.push(`Предварительная стоимость: ${formatPrice(order.totalPrice)} ₽`)
  return lines.join('\n')
}

/**
 * `lead_tracking_id` is the order's own `id` — already a stable UUID, generated once per order
 * by Postgres. Reusing it as-is (no new tracking state in CleanTrack) means the CRM's own
 * idempotency (`insertLead`'s `ON CONFLICT (lead_tracking_id)`) already guarantees one order can
 * never become two leads or two Telegram notifications, even if the sync is retried.
 */
export function buildCrmLeadPayload(order: CrmSyncOrder) {
  return {
    project: 'cleantrack',
    name: order.clientName,
    phone: order.clientPhone,
    source: 'Telegram',
    // The only order entry point this bot has — distinct from `source` (where the lead came from).
    channel: 'Telegram',
    service: 'Уборка квартиры',
    message: orderMessage(order),
    lead_tracking_id: order.id,
  }
}
