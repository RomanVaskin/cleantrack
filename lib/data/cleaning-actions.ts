'use server'

import { randomBytes } from 'node:crypto'
import { getPostgresPool, withTransaction } from '@/lib/db/postgres'
import { DEMO_CLEANING_ID } from '@/lib/data/cleanings'

let mockClientToken: string | null = null

export interface WriteResult {
  ok: boolean
}

export interface CompleteCleaningResult extends WriteResult {
  completedAt?: string
}

export interface AcceptCleaningResult extends WriteResult {
  acceptedAt?: string
}

export interface ClientLinkResult extends WriteResult {
  token?: string
}

export interface CleaningClientInput {
  clientName: string
  clientPhone?: string | null
  address: string
}

export interface CreateCleaningInput {
  clientName: string
  clientPhone?: string | null
  address: string
  selectedServiceIds: string[]
  cabinets: 'all' | 'selected' | 'none'
  moveItems: 'return' | 'agree' | 'none'
  doNotTouch?: string
  wishes?: string
}

export interface CreateCleaningResult {
  ok: boolean
  cleaningId?: string
  error?: 'validation' | 'server'
  field?: 'clientName' | 'address' | 'services' | 'serviceId'
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function createCleaning(data: CreateCleaningInput): Promise<CreateCleaningResult> {
  try {
    if (!data || typeof data !== 'object') return { ok: false, error: 'validation' }

    const clientName = typeof data.clientName === 'string' ? data.clientName.trim() : ''
    const clientPhone = typeof data.clientPhone === 'string' ? data.clientPhone.trim() : ''
    const address = typeof data.address === 'string' ? data.address.trim() : ''
    const doNotTouch = typeof data.doNotTouch === 'string' ? data.doNotTouch.trim() : ''
    const wishes = typeof data.wishes === 'string' ? data.wishes.trim() : ''
    const selectedServiceIds = Array.isArray(data.selectedServiceIds)
      ? [...new Set(data.selectedServiceIds)]
      : []

    if (!clientName || clientName.length > 120) return { ok: false, error: 'validation', field: 'clientName' }
    if (!address || address.length > 300) return { ok: false, error: 'validation', field: 'address' }
    if (clientPhone.length > 40 || doNotTouch.length > 1000 || wishes.length > 1000) {
      return { ok: false, error: 'validation' }
    }
    if (selectedServiceIds.length === 0) return { ok: false, error: 'validation', field: 'services' }
    if (
      !['all', 'selected', 'none'].includes(data.cabinets)
      || !['return', 'agree', 'none'].includes(data.moveItems)
      || selectedServiceIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))
    ) return { ok: false, error: 'validation', field: 'serviceId' }

    const pool = getPostgresPool()
    if (!pool) return { ok: false, error: 'server' }

    return await withTransaction(pool, async (client) => {
      const serviceResult = await client.query<{ id: string }>(
        'SELECT id FROM services WHERE id = ANY($1::uuid[])',
        [selectedServiceIds],
      )
      if (serviceResult.rowCount !== selectedServiceIds.length) {
        return { ok: false, error: 'validation' as const, field: 'serviceId' as const }
      }

      // Serialize number generation for concurrent creates in this MVP.
      await client.query('SELECT pg_advisory_xact_lock(482917)')
      const numberResult = await client.query<{ next_number: string }>(
        `SELECT (COALESCE(MAX(number::bigint), 0) + 1)::text AS next_number
         FROM cleanings WHERE number ~ '^[0-9]+$'`,
      )
      const number = numberResult.rows[0].next_number
      const cleaningResult = await client.query<{ id: string }>(
        `INSERT INTO cleanings
          (number, client_name, client_phone, address, started_at, status,
           completed_at, accepted_at, client_token, created_at)
         VALUES ($1, $2, $3, $4, now(), 'in_progress', NULL, NULL, NULL, now())
         RETURNING id`,
        [number, clientName, clientPhone || null, address],
      )
      const cleaningId = cleaningResult.rows[0].id

      for (const serviceId of selectedServiceIds) {
        await client.query(
          `INSERT INTO cleaning_services
            (cleaning_id, service_id, is_selected, is_done, completed_at)
           VALUES ($1, $2, true, false, NULL)`,
          [cleaningId, serviceId],
        )
      }

      await client.query(
        `INSERT INTO client_rules
          (cleaning_id, cabinets_access, personal_items_access, do_not_touch, special_requests)
         VALUES ($1, $2, $3, $4, $5)`,
        [cleaningId, data.cabinets, data.moveItems, doNotTouch, wishes],
      )

      return { ok: true, cleaningId }
    })
  } catch {
    return { ok: false, error: 'server' }
  }
}

export async function updateCleaningClient(
  cleaningId: string,
  data: CleaningClientInput,
): Promise<WriteResult> {
  try {
    if (!data || typeof data !== 'object') return { ok: false }
    if (typeof data.clientName !== 'string' || typeof data.address !== 'string') {
      return { ok: false }
    }
    const rawClientPhone = data.clientPhone ?? ''
    if (typeof rawClientPhone !== 'string') return { ok: false }

    const clientName = data.clientName.trim()
    const clientPhone = rawClientPhone.trim()
    const address = data.address.trim()
    if (
      !clientName
      || clientName.length > 120
      || clientPhone.length > 40
      || !address
      || address.length > 300
    ) return { ok: false }

    const pool = getPostgresPool()
    if (!pool) return { ok: cleaningId === DEMO_CLEANING_ID }

    const result = await pool.query(
      `UPDATE cleanings
       SET client_name = $2, client_phone = $3, address = $4
       WHERE id = $1`,
      [cleaningId, clientName, clientPhone || null, address],
    )
    return { ok: result.rowCount === 1 }
  } catch {
    return { ok: false }
  }
}

export async function getOrCreateClientLink(cleaningId: string): Promise<ClientLinkResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) {
      if (cleaningId !== DEMO_CLEANING_ID) return { ok: false }
      mockClientToken ??= randomBytes(24).toString('base64url')
      return { ok: true, token: mockClientToken }
    }

    return await withTransaction(pool, async (client) => {
      const result = await client.query<{ client_token: string | null }>(
        'SELECT client_token FROM cleanings WHERE id = $1 FOR UPDATE',
        [cleaningId],
      )
      const cleaning = result.rows[0]
      if (!cleaning) return { ok: false }
      if (cleaning.client_token) return { ok: true, token: cleaning.client_token }

      const token = randomBytes(24).toString('base64url')
      await client.query('UPDATE cleanings SET client_token = $2 WHERE id = $1', [cleaningId, token])
      return { ok: true, token }
    })
  } catch {
    return { ok: false }
  }
}

/** Without a database, the existing UI keeps changes in local state. */
export async function updateChecklistItem(itemId: string, isDone: boolean): Promise<WriteResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) return { ok: true }
    if (typeof itemId !== 'string' || typeof isDone !== 'boolean') return { ok: false }

    return await withTransaction(pool, async (client) => {
      // Both writes lock the parent first to serialize completion and checkbox updates.
      // Retain the former demo-only write scope until authentication is introduced.
      const cleaning = await client.query(
        'SELECT id FROM cleanings WHERE id = $1 FOR UPDATE',
        [DEMO_CLEANING_ID],
      )
      if (cleaning.rowCount !== 1) return { ok: false }

      const result = await client.query(
        `UPDATE cleaning_services
         SET is_done = $2, completed_at = CASE WHEN $2 THEN now() ELSE NULL END
         WHERE id = $1 AND cleaning_id = $3`,
        [itemId, isDone, DEMO_CLEANING_ID],
      )
      return { ok: result.rowCount === 1 }
    })
  } catch {
    return { ok: false }
  }
}

export async function completeCleaning(cleaningId: string): Promise<CompleteCleaningResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) return { ok: true, completedAt: new Date().toISOString() }
    if (cleaningId !== DEMO_CLEANING_ID) return { ok: false }

    return await withTransaction(pool, async (client) => {
      const cleaningResult = await client.query<{
        status: string
        completed_at: Date | null
      }>(
        'SELECT status, completed_at FROM cleanings WHERE id = $1 FOR UPDATE',
        [cleaningId],
      )
      const cleaning = cleaningResult.rows[0]
      if (!cleaning) return { ok: false }

      const pending = await client.query(
        `SELECT 1 FROM cleaning_services
         WHERE cleaning_id = $1 AND is_selected AND NOT is_done LIMIT 1`,
        [cleaningId],
      )
      if (pending.rowCount !== 0) return { ok: false }

      if (cleaning.status === 'completed') {
        return {
          ok: true,
          ...(cleaning.completed_at && { completedAt: cleaning.completed_at.toISOString() }),
        }
      }
      if (cleaning.status !== 'in_progress') return { ok: false }

      const result = await client.query<{ completed_at: Date }>(
        `UPDATE cleanings
         SET status = 'completed', completed_at = now()
         WHERE id = $1
         RETURNING completed_at`,
        [cleaningId],
      )
      return { ok: true, completedAt: result.rows[0].completed_at.toISOString() }
    })
  } catch {
    return { ok: false }
  }
}

export async function acceptCleaning(cleaningId: string): Promise<AcceptCleaningResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) {
      return cleaningId === DEMO_CLEANING_ID
        ? { ok: true, acceptedAt: new Date().toISOString() }
        : { ok: false }
    }

    return await withTransaction(pool, async (client) => {
      const result = await client.query<{ status: string; accepted_at: Date | null }>(
        `SELECT status, accepted_at FROM cleanings
         WHERE id = $1 FOR UPDATE`,
        [cleaningId],
      )
      const cleaning = result.rows[0]
      if (!cleaning) return { ok: false }
      if (cleaning.status === 'accepted') {
        return {
          ok: true,
          ...(cleaning.accepted_at && { acceptedAt: cleaning.accepted_at.toISOString() }),
        }
      }
      if (cleaning.status !== 'completed') return { ok: false }

      const accepted = await client.query<{ accepted_at: Date }>(
        `UPDATE cleanings
         SET status = 'accepted', accepted_at = now()
         WHERE id = $1
         RETURNING accepted_at`,
        [cleaningId],
      )
      return { ok: true, acceptedAt: accepted.rows[0].accepted_at.toISOString() }
    })
  } catch {
    return { ok: false }
  }
}
