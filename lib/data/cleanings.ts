import 'server-only'
import { connection } from 'next/server'
import { getCleaningPhotos } from '@/lib/data/photos'
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

/** Уборка, которую показывает demo-экран клинера на этом этапе. */
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
  client_phone: string | null
  address: string | null
  started_at: Date | null
  status: string | null
  completed_at: Date | null
  accepted_at: Date | null
  client_token: string | null
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

function getMockCleaningData(): CleaningData {
  return {
    cleaning: mockCleaning,
    checklist: getMockChecklist(),
    clientRules: mockClientRules,
    photos: mockPhotos,
  }
}

function toStatus(value: string | null): CleaningStatus {
  if (value === 'accepted') return 'accepted'
  return value === 'completed' ? 'completed' : 'in_progress'
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

    return (await readCleaningData(cleaningId)) ?? getMockCleaningData()
  } catch {
    return getMockCleaningData()
  }
}

/** Token routes never fall back to demo data: an unknown token is not a cleaning. */
export async function getCleaningDataByClientToken(token: string): Promise<CleaningData | null> {
  await connection()

  try {
    const pool = getPostgresPool()
    if (!pool || typeof token !== 'string' || token.length === 0) return null

    const result = await pool.query<{ id: string }>(
      'SELECT id FROM cleanings WHERE client_token = $1',
      [token],
    )
    const cleaning = result.rows[0]
    return cleaning ? await readCleaningData(cleaning.id) : null
  } catch {
    return null
  }
}

async function readCleaningData(cleaningId: string): Promise<CleaningData | null> {
  const pool = getPostgresPool()
  if (!pool) return null

  const [cleaningRes, servicesRes, rulesRes, photos] = await Promise.all([
    pool.query<CleaningRow>(
      `SELECT id, number, client_name, client_phone, address, started_at, status, completed_at,
              accepted_at, client_token
       FROM cleanings WHERE id = $1`,
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
    getCleaningPhotos(cleaningId),
  ])

  const cleaningRow = cleaningRes.rows[0]
  if (!cleaningRow) return null

  const cleaning: Cleaning = {
    id: cleaningRow.id,
    number: cleaningRow.number ?? '',
    address: cleaningRow.address ?? '',
    client: cleaningRow.client_name ?? '',
    clientPhone: cleaningRow.client_phone,
    startedAt: cleaningRow.started_at?.toISOString() ?? '',
    status: toStatus(cleaningRow.status),
    completedAt: cleaningRow.completed_at?.toISOString() ?? null,
    acceptedAt: cleaningRow.accepted_at?.toISOString() ?? null,
    clientToken: cleaningRow.client_token,
  }

  const checklist: ChecklistItem[] = servicesRes.rows.map((row) => ({
    id: row.id,
    serviceId: row.service_id,
    label: row.title,
    included: row.is_selected,
    done: row.is_done,
    photo: photos.find((photo) => photo.cleaningServiceId === row.id) ?? null,
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

  return { cleaning, checklist, clientRules, photos }
}
