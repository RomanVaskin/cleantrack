import 'server-only'
import { connection } from 'next/server'
import { getPostgresPool } from '@/lib/db/postgres'
import {
  cleaning as mockCleaning,
  clientRules as mockClientRules,
  getInitialChecklist as getMockChecklist,
  photos as mockPhotos,
} from '@/lib/mock-data'
import type {
  CabinetRule,
  ChecklistItem,
  Cleaning,
  ClientRules,
  CleaningStatus,
  MoveRule,
  Photo,
} from '@/lib/types'

/** Уборка, которую показывают /cleaner и /client на этом этапе (без роутинга по id). */
export const DEMO_CLEANING_ID = process.env.DEMO_CLEANING_ID || mockCleaning.id

export interface CleaningData {
  cleaning: Cleaning
  checklist: ChecklistItem[]
  clientRules: ClientRules
  photos: Photo[]
}

interface CleaningRow {
  id: string
  number: string | null
  client_name: string | null
  address: string | null
  started_at: Date | null
  status: string | null
}

interface CleaningServiceRow {
  id: string
  is_selected: boolean
  is_done: boolean
  note: string | null
  service_id: string
  title: string
}

interface ClientRulesRow {
  cabinets_access: string | null
  personal_items_access: string | null
  do_not_touch: string | null
  special_requests: string | null
}

interface PhotoRow {
  storage_path: string
}

function getMockCleaningData(): CleaningData {
  return {
    cleaning: mockCleaning,
    checklist: getMockChecklist(),
    clientRules: mockClientRules,
    photos: mockPhotos,
  }
}

function toStatus(value: string | null): CleaningStatus {
  return value === 'completed' ? 'completed' : 'in_progress'
}

function formatStartedAt(value: Date | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })
}

/**
 * Reads at request time, so builds never connect to a database or cache demo data.
 * Missing configuration/read failures retain the existing mock fallback.
 */
export async function getCleaningData(cleaningId: string): Promise<CleaningData> {
  await connection()

  try {
    const pool = getPostgresPool()
    if (!pool) return getMockCleaningData()

    const [cleaningRes, servicesRes, rulesRes, photosRes] = await Promise.all([
      pool.query<CleaningRow>(
        'SELECT id, number, client_name, address, started_at, status FROM cleanings WHERE id = $1',
        [cleaningId],
      ),
      pool.query<CleaningServiceRow>(
        `SELECT cs.id, cs.service_id, cs.is_selected, cs.is_done, cs.note, s.title
         FROM cleaning_services cs JOIN services s ON s.id = cs.service_id
         WHERE cs.cleaning_id = $1 ORDER BY s.sort_order, s.id, cs.id`,
        [cleaningId],
      ),
      pool.query<ClientRulesRow>(
        `SELECT cabinets_access, personal_items_access, do_not_touch, special_requests
         FROM client_rules WHERE cleaning_id = $1`,
        [cleaningId],
      ),
      pool.query<PhotoRow>(
        'SELECT storage_path FROM photos WHERE cleaning_id = $1 ORDER BY created_at, id',
        [cleaningId],
      ),
    ])

    const cleaningRow = cleaningRes.rows[0]
    if (!cleaningRow) return getMockCleaningData()

    const cleaning: Cleaning = {
      id: cleaningRow.id,
      number: cleaningRow.number ?? '',
      address: cleaningRow.address ?? '',
      client: cleaningRow.client_name ?? '',
      startedAt: formatStartedAt(cleaningRow.started_at),
      status: toStatus(cleaningRow.status),
    }

    const checklist: ChecklistItem[] = servicesRes.rows.map((row) => ({
      id: row.id,
      serviceId: row.service_id,
      label: row.title,
      included: row.is_selected,
      done: row.is_done,
      photo: null,
      note: row.note ?? undefined,
    }))

    const rulesRow = rulesRes.rows[0]
    const clientRules: ClientRules = rulesRow
      ? {
          cabinets: (rulesRow.cabinets_access as CabinetRule | null) ?? 'none',
          moveItems: (rulesRow.personal_items_access as MoveRule | null) ?? 'none',
          doNotTouch: rulesRow.do_not_touch ?? '',
          wishes: rulesRow.special_requests ?? '',
        }
      : mockClientRules

    const photoRows = photosRes.rows
    const photos: Photo[] = photoRows.map((row) => ({
      src: row.storage_path,
      alt: 'Фото уборки',
    }))

    return { cleaning, checklist, clientRules, photos }
  } catch {
    return getMockCleaningData()
  }
}
