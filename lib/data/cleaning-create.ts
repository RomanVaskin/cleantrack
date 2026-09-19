import 'server-only'

import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'

export interface CleaningServiceSelection {
  id: string
  note?: string
}

export interface CreateCleaningRecordInput {
  clientName: string
  clientPhone: string | null
  address: string
  services: CleaningServiceSelection[]
  cabinets: 'all' | 'selected' | 'none'
  moveItems: 'return' | 'agree' | 'none'
  doNotTouch: string
  wishes: string
  photoReportEnabled?: boolean
  requestedDate?: string | null
  requestedTime?: string | null
  createClientToken?: boolean
}

export type CreateCleaningRecordResult =
  | {
      ok: true
      cleaningId: string
      cleaningNumber: string
      clientToken: string | null
    }
  | { ok: false; field: 'serviceId' }

/** Creates a cleaning inside the caller's transaction using the shared number sequence. */
export async function createCleaningRecord(
  client: PoolClient,
  input: CreateCleaningRecordInput,
): Promise<CreateCleaningRecordResult> {
  const serviceIds = input.services.map((service) => service.id)
  const serviceResult = await client.query<{ id: string }>(
    'SELECT id FROM services WHERE id = ANY($1::uuid[])',
    [serviceIds],
  )
  if (serviceResult.rowCount !== serviceIds.length) return { ok: false, field: 'serviceId' }

  // This is the existing CleanTrack cleaning-number serialization mechanism.
  await client.query('SELECT pg_advisory_xact_lock(482917)')
  const numberResult = await client.query<{ next_number: string }>(
    `SELECT (COALESCE(MAX(number::bigint), 0) + 1)::text AS next_number
     FROM cleanings WHERE number ~ '^[0-9]+$'`,
  )
  const cleaningNumber = numberResult.rows[0].next_number
  const cleaningResult = await client.query<{ id: string }>(
    `INSERT INTO cleanings
      (number, client_name, client_phone, address, started_at, status,
       completed_at, accepted_at, client_token, photo_report_enabled,
       requested_date, requested_time, created_at)
     VALUES ($1, $2, $3, $4, now(), 'in_progress', NULL, NULL, NULL, $5, $6, $7, now())
     RETURNING id`,
    [
      cleaningNumber,
      input.clientName,
      input.clientPhone,
      input.address,
      Boolean(input.photoReportEnabled),
      input.requestedDate ?? null,
      input.requestedTime ?? null,
    ],
  )
  const cleaningId = cleaningResult.rows[0].id

  for (const service of input.services) {
    await client.query(
      `INSERT INTO cleaning_services
        (cleaning_id, service_id, is_selected, is_done, note, completed_at)
       VALUES ($1, $2, true, false, $3, NULL)`,
      [cleaningId, service.id, service.note ?? null],
    )
  }

  await client.query(
    `INSERT INTO client_rules
      (cleaning_id, cabinets_access, personal_items_access, do_not_touch, special_requests)
     VALUES ($1, $2, $3, $4, $5)`,
    [cleaningId, input.cabinets, input.moveItems, input.doNotTouch, input.wishes],
  )

  const clientToken = input.createClientToken
    ? await getOrCreateClientToken(client, cleaningId)
    : null
  return { ok: true, cleaningId, cleaningNumber, clientToken }
}

/** Uses the same row lock and cryptographic token as the existing share-link action. */
export async function getOrCreateClientToken(
  client: PoolClient,
  cleaningId: string,
): Promise<string | null> {
  const result = await client.query<{ client_token: string | null }>(
    'SELECT client_token FROM cleanings WHERE id = $1 FOR UPDATE',
    [cleaningId],
  )
  const cleaning = result.rows[0]
  if (!cleaning) return null
  if (cleaning.client_token) return cleaning.client_token

  const token = randomBytes(24).toString('base64url')
  await client.query('UPDATE cleanings SET client_token = $2 WHERE id = $1', [cleaningId, token])
  return token
}
