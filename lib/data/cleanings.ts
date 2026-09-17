import { createSupabaseServerClient } from '@/lib/supabase/server'
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
export const DEMO_CLEANING_ID = process.env.DEMO_CLEANING_ID ?? mockCleaning.id

const PHOTOS_BUCKET = 'cleaning-photos'

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
  started_at: string | null
  status: string | null
}

interface CleaningServiceRow {
  id: string
  is_selected: boolean
  is_done: boolean
  note: string | null
  services: { id: string; title: string; sort_order: number } | null
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

function formatStartedAt(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })
}

function resolvePhotoSrc(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  storagePath: string,
): string {
  if (storagePath.startsWith('http') || storagePath.startsWith('/')) return storagePath
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

/**
 * Читает одну уборку из Supabase (только чтение). Если Supabase не
 * настроен (нет env) или запрос упал — тихо откатывается на mock-данные
 * проекта, не показывая пользователю техническую ошибку.
 */
export async function getCleaningData(cleaningId: string): Promise<CleaningData> {
  const supabase = createSupabaseServerClient()
  if (!supabase) return getMockCleaningData()

  try {
    const [cleaningRes, servicesRes, rulesRes, photosRes] = await Promise.all([
      supabase.from('cleanings').select('*').eq('id', cleaningId).maybeSingle(),
      supabase
        .from('cleaning_services')
        .select('id, is_selected, is_done, note, services(id, title, sort_order)')
        .eq('cleaning_id', cleaningId),
      supabase.from('client_rules').select('*').eq('cleaning_id', cleaningId).maybeSingle(),
      supabase.from('photos').select('storage_path').eq('cleaning_id', cleaningId),
    ])

    if (cleaningRes.error || servicesRes.error || rulesRes.error || photosRes.error) {
      return getMockCleaningData()
    }

    const cleaningRow = cleaningRes.data as CleaningRow | null
    if (!cleaningRow) return getMockCleaningData()

    const cleaning: Cleaning = {
      id: cleaningRow.id,
      number: cleaningRow.number ?? '',
      address: cleaningRow.address ?? '',
      client: cleaningRow.client_name ?? '',
      startedAt: formatStartedAt(cleaningRow.started_at),
      status: toStatus(cleaningRow.status),
    }

    const serviceRows = (servicesRes.data ?? []) as unknown as CleaningServiceRow[]
    const checklist: ChecklistItem[] = serviceRows
      .slice()
      .sort((a, b) => (a.services?.sort_order ?? 0) - (b.services?.sort_order ?? 0))
      .map((row) => ({
        id: row.id,
        serviceId: row.services?.id ?? row.id,
        label: row.services?.title ?? '',
        included: row.is_selected,
        done: row.is_done,
        photo: null,
        note: row.note ?? undefined,
      }))

    const rulesRow = rulesRes.data as ClientRulesRow | null
    const clientRules: ClientRules = rulesRow
      ? {
          cabinets: (rulesRow.cabinets_access as CabinetRule | null) ?? 'none',
          moveItems: (rulesRow.personal_items_access as MoveRule | null) ?? 'none',
          doNotTouch: rulesRow.do_not_touch ?? '',
          wishes: rulesRow.special_requests ?? '',
        }
      : mockClientRules

    const photoRows = (photosRes.data ?? []) as PhotoRow[]
    const photos: Photo[] = photoRows.map((row) => ({
      src: resolvePhotoSrc(supabase, row.storage_path),
      alt: 'Фото уборки',
    }))

    return { cleaning, checklist, clientRules, photos }
  } catch {
    return getMockCleaningData()
  }
}
