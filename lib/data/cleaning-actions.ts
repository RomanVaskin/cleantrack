'use server'

import { getPostgresPool, withTransaction } from '@/lib/db/postgres'
import { DEMO_CLEANING_ID } from '@/lib/data/cleanings'

export interface WriteResult {
  ok: boolean
}

export interface AcceptCleaningResult extends WriteResult {
  acceptedAt?: string
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

export async function completeCleaning(cleaningId: string): Promise<WriteResult> {
  try {
    const pool = getPostgresPool()
    if (!pool) return { ok: true }
    if (cleaningId !== DEMO_CLEANING_ID) return { ok: false }

    return await withTransaction(pool, async (client) => {
      const cleaning = await client.query(
        'SELECT id FROM cleanings WHERE id = $1 FOR UPDATE',
        [cleaningId],
      )
      if (cleaning.rowCount !== 1) return { ok: false }

      const pending = await client.query(
        `SELECT 1 FROM cleaning_services
         WHERE cleaning_id = $1 AND is_selected AND NOT is_done LIMIT 1`,
        [cleaningId],
      )
      if (pending.rowCount !== 0) return { ok: false }

      const result = await client.query(
        "UPDATE cleanings SET status = 'completed' WHERE id = $1",
        [cleaningId],
      )
      return { ok: result.rowCount === 1 }
    })
  } catch {
    return { ok: false }
  }
}

export async function acceptCleaning(cleaningId: string): Promise<AcceptCleaningResult> {
  try {
    if (cleaningId !== DEMO_CLEANING_ID) return { ok: false }
    const pool = getPostgresPool()
    if (!pool) return { ok: true, acceptedAt: new Date().toISOString() }

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
