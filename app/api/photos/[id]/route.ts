import { getPostgresPool } from '@/lib/db/postgres'
import { DEMO_CLEANING_ID } from '@/lib/data/cleanings'
import { readStoredPhoto, UUID_PATTERN } from '@/lib/server/photo-storage'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const missing = () => new Response(null, { status: 404 })
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) return missing()
  try {
    const pool = getPostgresPool()
    if (!pool) return missing()
    const result = await pool.query<{ storage_path: string }>(
      'SELECT storage_path FROM photos WHERE id = $1 AND cleaning_id = $2', [id, DEMO_CLEANING_ID],
    )
    if (!result.rows[0]) return missing()
    const { bytes, type } = await readStoredPhoto(result.rows[0].storage_path)
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': type,
      'Content-Length': String(bytes.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    } })
  } catch {
    return missing()
  }
}
