'use server'

import { getPostgresPool, withTransaction } from '@/lib/db/postgres'
import { DEMO_CLEANING_ID } from '@/lib/data/cleanings'

export interface WriteResult {
  ok: boolean
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
