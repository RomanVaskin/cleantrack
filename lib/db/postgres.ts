import 'server-only'

import { Pool, type PoolClient } from 'pg'

const globalForPostgres = globalThis as typeof globalThis & {
  cleanTrackPool?: Pool
}

/** One lazy pool per server process, including development hot reloads. */
export function getPostgresPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null

  if (!globalForPostgres.cleanTrackPool) {
    const pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    })
    // Never log connection details or leave idle connection errors unhandled.
    pool.on('error', () => console.error('CleanTrack: idle database connection failed'))
    globalForPostgres.cleanTrackPool = pool
  }
  return globalForPostgres.cleanTrackPool
}

/** All statements in a transaction must use the same checked-out client. */
export async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  let discard = false
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      discard = true
    }
    throw error
  } finally {
    client.release(discard)
  }
}
