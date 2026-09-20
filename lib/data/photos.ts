import 'server-only'
import { getPostgresPool } from '@/lib/db/postgres'
import { isSectionCode } from '@/lib/checklist-sections'
import { photos as mockPhotos } from '@/lib/mock-data'
import { removeStoredPhoto, savePhoto, UUID_PATTERN } from '@/lib/server/photo-storage'
import type { Photo, SectionCode } from '@/lib/types'

interface PhotoRow {
  id: string
  storage_path: string
  cleaning_service_id: string | null
  section_code: string | null
}

function toPhoto(row: PhotoRow): Photo {
  const demo = mockPhotos.find((photo) => photo.src === row.storage_path)
  return {
    id: row.id,
    cleaningServiceId: row.cleaning_service_id,
    sectionCode: (row.section_code as SectionCode | null) ?? null,
    src: demo?.src ?? `/api/photos/${row.id}`,
    alt: 'Фото уборки',
  }
}

export async function getCleaningPhotos(cleaningId: string): Promise<Photo[]> {
  const pool = getPostgresPool()
  if (!pool) return mockPhotos
  const result = await pool.query<PhotoRow>(
    'SELECT id, cleaning_service_id, section_code, storage_path FROM photos WHERE cleaning_id = $1 ORDER BY created_at, id', [cleaningId],
  )
  return result.rows.map(toPhoto)
}

export async function uploadCleaningPhoto(
  cleaningId: string,
  serviceId: string | null,
  sectionCode: SectionCode | null,
  bytes: Buffer,
): Promise<Photo> {
  const pool = getPostgresPool()
  if (
    !pool
    || !UUID_PATTERN.test(cleaningId)
    || (serviceId !== null && !UUID_PATTERN.test(serviceId))
    || (sectionCode !== null && !isSectionCode(sectionCode))
    || (serviceId !== null && sectionCode !== null)
  ) throw new Error('Invalid target')
  const target = await pool.query(
    `SELECT id FROM cleanings WHERE id = $1 AND
     ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM cleaning_services WHERE id = $2 AND cleaning_id = $1))`,
    [cleaningId, serviceId],
  )
  if (target.rowCount !== 1) throw new Error('Invalid target')
  const storagePath = await savePhoto(bytes)
  try {
    const result = await pool.query<PhotoRow>(
      `INSERT INTO photos (cleaning_id, cleaning_service_id, section_code, storage_path)
       VALUES ($1, $2, $3, $4) RETURNING id, cleaning_service_id, section_code, storage_path`,
      [cleaningId, serviceId, sectionCode, storagePath],
    )
    return toPhoto(result.rows[0])
  } catch (error) {
    await removeStoredPhoto(storagePath).catch(() => {})
    throw error
  }
}
