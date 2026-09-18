import 'server-only'

import {
  createCleaningRecord,
  getOrCreateClientToken,
  type CleaningServiceSelection,
} from '@/lib/data/cleaning-create'
import { getPostgresPool, withTransaction } from '@/lib/db/postgres'

interface TelegramOrderRow {
  id: string
  number: string
  telegram_chat_id: string
  client_name: string
  client_phone: string
  address: string
  windows_count: number
  ironing_hours: number
  balcony: boolean
  other_request: string | null
  photo_report_enabled: boolean
  status: string
  cleaning_id: string | null
}

export type ConfirmTelegramOrderResult =
  | {
      kind: 'confirmed'
      orderNumber: string
      clientChatId: string
      cleaningId: string
      cleaningNumber: string
      clientToken: string
    }
  | { kind: 'rejected' | 'not_found' | 'error' }

export type RejectTelegramOrderResult =
  | { kind: 'rejected'; orderNumber: string; clientChatId: string }
  | { kind: 'confirmed' | 'not_found' | 'error' }

function specialRequests(order: TelegramOrderRow): string {
  const lines: string[] = []
  if (order.balcony) lines.push('Мытьё балкона / лоджии')
  if (order.other_request) lines.push(`Дополнительно: ${order.other_request}`)
  return lines.join('\n')
}

export async function confirmTelegramOrder(orderId: string): Promise<ConfirmTelegramOrderResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) return { kind: 'error' }

    return await withTransaction(pool, async (client): Promise<ConfirmTelegramOrderResult> => {
      const orderResult = await client.query<TelegramOrderRow>(
        `SELECT id, number, telegram_chat_id, client_name, client_phone, address,
                windows_count, ironing_hours, balcony, other_request,
                photo_report_enabled, status, cleaning_id
         FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      )
      const order = orderResult.rows[0]
      if (!order) return { kind: 'not_found' }
      if (order.status === 'rejected') return { kind: 'rejected' }

      if (order.status === 'confirmed' && order.cleaning_id) {
        const cleaningResult = await client.query<{ number: string }>(
          'SELECT number FROM cleanings WHERE id = $1',
          [order.cleaning_id],
        )
        const cleaning = cleaningResult.rows[0]
        const clientToken = await getOrCreateClientToken(client, order.cleaning_id)
        if (!cleaning || !clientToken) return { kind: 'error' }
        return {
          kind: 'confirmed',
          orderNumber: order.number,
          clientChatId: order.telegram_chat_id,
          cleaningId: order.cleaning_id,
          cleaningNumber: cleaning.number,
          clientToken,
        }
      }
      if (order.status !== 'new') return { kind: 'error' }

      const requiredCodes = [
        's1',
        ...(order.windows_count > 0 ? ['s7'] : []),
        ...(order.ironing_hours > 0 ? ['s3'] : []),
      ]
      const servicesResult = await client.query<{ id: string; code: string }>(
        'SELECT id, code FROM services WHERE code = ANY($1::text[])',
        [requiredCodes],
      )
      const servicesByCode = new Map(servicesResult.rows.map((service) => [service.code, service.id]))
      if (requiredCodes.some((code) => !servicesByCode.has(code))) return { kind: 'error' }

      const services: CleaningServiceSelection[] = [{ id: servicesByCode.get('s1')! }]
      if (order.windows_count > 0) {
        services.push({
          id: servicesByCode.get('s7')!,
          note: countLabel(order.windows_count, 'окно', 'окна', 'окон'),
        })
      }
      if (order.ironing_hours > 0) {
        services.push({
          id: servicesByCode.get('s3')!,
          note: countLabel(order.ironing_hours, 'час', 'часа', 'часов'),
        })
      }

      const cleaning = await createCleaningRecord(client, {
        clientName: order.client_name,
        clientPhone: order.client_phone,
        address: order.address,
        services,
        cabinets: 'none',
        moveItems: 'none',
        doNotTouch: '',
        wishes: specialRequests(order),
        photoReportEnabled: order.photo_report_enabled,
        createClientToken: true,
      })
      if (!cleaning.ok || !cleaning.clientToken) return { kind: 'error' }

      await client.query(
        `UPDATE orders SET status = 'confirmed', cleaning_id = $2
         WHERE id = $1`,
        [order.id, cleaning.cleaningId],
      )
      return {
        kind: 'confirmed',
        orderNumber: order.number,
        clientChatId: order.telegram_chat_id,
        cleaningId: cleaning.cleaningId,
        cleaningNumber: cleaning.cleaningNumber,
        clientToken: cleaning.clientToken,
      }
    })
  } catch {
    return { kind: 'error' }
  }
}

export async function rejectTelegramOrder(orderId: string): Promise<RejectTelegramOrderResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) return { kind: 'error' }

    return await withTransaction(pool, async (client): Promise<RejectTelegramOrderResult> => {
      const result = await client.query<TelegramOrderRow>(
        `SELECT id, number, telegram_chat_id, client_name, client_phone, address,
                windows_count, ironing_hours, balcony, other_request,
                photo_report_enabled, status, cleaning_id
         FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      )
      const order = result.rows[0]
      if (!order) return { kind: 'not_found' }
      if (order.status === 'confirmed') return { kind: 'confirmed' }
      if (order.status !== 'new' && order.status !== 'rejected') return { kind: 'error' }

      if (order.status === 'new') {
        await client.query("UPDATE orders SET status = 'rejected' WHERE id = $1", [order.id])
      }
      return {
        kind: 'rejected',
        orderNumber: order.number,
        clientChatId: order.telegram_chat_id,
      }
    })
  } catch {
    return { kind: 'error' }
  }
}

function countLabel(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100
  const mod10 = count % 10
  const noun = mod100 >= 11 && mod100 <= 14
    ? many
    : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many
  return `${count} ${noun}`
}
