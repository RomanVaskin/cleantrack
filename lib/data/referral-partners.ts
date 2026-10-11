import 'server-only'

import { randomBytes } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { getPostgresPool } from '@/lib/db/postgres'

export interface ReferralPartner {
  id: string
  name: string
  code: string
  accessToken: string
  commissionPercent: number
  active: boolean
  createdAt: string
}

export interface ReferralOrderSummary {
  id: string
  number: string
  createdAt: string
  totalPrice: number
  statusLabel: string
  completed: boolean
  commission: number
}

export interface ReferralPartnerStats {
  id: string
  name: string
  code: string
  active: boolean
  commissionPercent: number
  ordersCount: number
  totalAmount: number
  completedAmount: number
  accruedCommission: number
}

export interface ReferralPartnerDetail extends ReferralPartnerStats {
  orders: ReferralOrderSummary[]
}

// Excludes visually ambiguous characters (0/O, 1/I) so a partner can read the code aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7
const TOKEN_BYTES = 24
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return code
}

function randomAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error
      && (error as { code?: unknown }).code === '23505',
  )
}

/** completed = commission source of truth: the order's linked cleaning has finished. */
function isCompleted(cleaningStatus: string | null): boolean {
  return cleaningStatus === 'completed' || cleaningStatus === 'accepted'
}

export function computeCommission(totalPrice: number, commissionPercent: number): number {
  return Math.round((totalPrice * commissionPercent) / 100)
}

function orderStatusLabel(orderStatus: string, cleaningStatus: string | null): string {
  if (orderStatus === 'rejected') return 'Отклонён'
  if (orderStatus !== 'confirmed') return 'Новый'
  if (isCompleted(cleaningStatus)) return 'Выполнен'
  if (cleaningStatus === 'in_progress') return 'В работе'
  return 'Подтверждён'
}

/** Creates a referral partner inside the caller's transaction, retrying on code/token collisions. */
export async function createReferralPartner(
  client: PoolClient,
  name: string,
): Promise<ReferralPartner> {
  const trimmedName = name.trim()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode()
    const accessToken = randomAccessToken()
    try {
      const result = await client.query<{
        id: string
        name: string
        code: string
        access_token: string
        commission_percent: number
        active: boolean
        created_at: Date
      }>(
        `INSERT INTO referral_partners (name, code, access_token)
         VALUES ($1, $2, $3)
         RETURNING id, name, code, access_token, commission_percent, active, created_at`,
        [trimmedName, code, accessToken],
      )
      const row = result.rows[0]
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        accessToken: row.access_token,
        commissionPercent: row.commission_percent,
        active: row.active,
        createdAt: row.created_at.toISOString(),
      }
    } catch (error) {
      if (isUniqueViolation(error)) continue
      throw error
    }
  }
  throw new Error('Failed to generate a unique referral code')
}

/** Attribution lookup: only an active partner can be attached to a new order. */
export async function getActiveReferralPartnerByCode(
  code: string,
): Promise<{ id: string; code: string } | null> {
  if (typeof code !== 'string' || !REFERRAL_CODE_PATTERN.test(code)) return null
  const pool = getPostgresPool()
  if (!pool) return null
  const result = await pool.query<{ id: string; code: string }>(
    'SELECT id, code FROM referral_partners WHERE code = $1 AND active = true',
    [code],
  )
  return result.rows[0] ?? null
}

/** Re-checked at order submission time so a partner disabled mid-flow never gets attributed. */
export async function getActiveReferralPartnerId(
  client: PoolClient,
  partnerId: string,
): Promise<string | null> {
  if (typeof partnerId !== 'string' || !UUID_PATTERN.test(partnerId)) return null
  const result = await client.query<{ id: string }>(
    'SELECT id FROM referral_partners WHERE id = $1 AND active = true',
    [partnerId],
  )
  return result.rows[0]?.id ?? null
}

interface PartnerRow {
  id: string
  name: string
  code: string
  active: boolean
  commission_percent: number
}

interface OrderStatsRow {
  id: string
  number: string
  created_at: Date
  total_price: number
  order_status: string
  cleaning_status: string | null
}

async function queryOrders(pool: Pool, partnerId: string): Promise<OrderStatsRow[]> {
  const result = await pool.query<OrderStatsRow>(
    `SELECT o.id, o.number, o.created_at, o.total_price,
            o.status AS order_status, c.status AS cleaning_status
     FROM orders o
     LEFT JOIN cleanings c ON c.id = o.cleaning_id
     WHERE o.referral_partner_id = $1
     ORDER BY o.created_at DESC`,
    [partnerId],
  )
  return result.rows
}

function toOrderSummary(row: OrderStatsRow, commissionPercent: number): ReferralOrderSummary {
  return {
    id: row.id,
    number: row.number,
    createdAt: row.created_at.toISOString(),
    totalPrice: row.total_price,
    statusLabel: orderStatusLabel(row.order_status, row.cleaning_status),
    completed: isCompleted(row.cleaning_status),
    commission: computeCommission(row.total_price, commissionPercent),
  }
}

function aggregateStats(partner: PartnerRow, orders: OrderStatsRow[]): ReferralPartnerStats {
  let totalAmount = 0
  let completedAmount = 0
  let accruedCommission = 0
  for (const order of orders) {
    totalAmount += order.total_price
    if (isCompleted(order.cleaning_status)) {
      completedAmount += order.total_price
      accruedCommission += computeCommission(order.total_price, partner.commission_percent)
    }
  }
  return {
    id: partner.id,
    name: partner.name,
    code: partner.code,
    active: partner.active,
    commissionPercent: partner.commission_percent,
    ordersCount: orders.length,
    totalAmount,
    completedAmount,
    accruedCommission,
  }
}

export async function listReferralPartnersWithStats(): Promise<ReferralPartnerStats[]> {
  const pool = getPostgresPool()
  if (!pool) return []
  const partnersResult = await pool.query<PartnerRow>(
    'SELECT id, name, code, active, commission_percent FROM referral_partners ORDER BY created_at DESC',
  )
  const stats: ReferralPartnerStats[] = []
  for (const partner of partnersResult.rows) {
    stats.push(aggregateStats(partner, await queryOrders(pool, partner.id)))
  }
  return stats
}

export async function getReferralPartnerStatsById(id: string): Promise<ReferralPartnerDetail | null> {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null
  const pool = getPostgresPool()
  if (!pool) return null
  const partnerResult = await pool.query<PartnerRow>(
    'SELECT id, name, code, active, commission_percent FROM referral_partners WHERE id = $1',
    [id],
  )
  const partner = partnerResult.rows[0]
  if (!partner) return null
  const orders = await queryOrders(pool, partner.id)
  return { ...aggregateStats(partner, orders), orders: orders.map((row) => toOrderSummary(row, partner.commission_percent)) }
}

export interface ReferralPartnerAdminDetail extends ReferralPartnerDetail {
  accessToken: string
}

/**
 * Admin-only lookup: the one place besides partner creation allowed to read back the access
 * token, so the bot's "open a referral partner" view can re-show the three links. Never used
 * by the public partner page — callers must gate this behind an admin chat id check.
 */
export async function getReferralPartnerAdminDetailById(id: string): Promise<ReferralPartnerAdminDetail | null> {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null
  const pool = getPostgresPool()
  if (!pool) return null
  const partnerResult = await pool.query<PartnerRow & { access_token: string }>(
    'SELECT id, name, code, access_token, active, commission_percent FROM referral_partners WHERE id = $1',
    [id],
  )
  const partner = partnerResult.rows[0]
  if (!partner) return null
  const orders = await queryOrders(pool, partner.id)
  return {
    ...aggregateStats(partner, orders),
    orders: orders.map((row) => toOrderSummary(row, partner.commission_percent)),
    accessToken: partner.access_token,
  }
}

/**
 * Public partner page lookup: resolved only by the long random access token, never by the
 * short public code. The returned shape never carries client PII or the access token itself.
 */
export async function getReferralPartnerByAccessToken(token: string): Promise<ReferralPartnerDetail | null> {
  if (typeof token !== 'string' || !ACCESS_TOKEN_PATTERN.test(token)) return null
  const pool = getPostgresPool()
  if (!pool) return null
  const partnerResult = await pool.query<PartnerRow>(
    'SELECT id, name, code, active, commission_percent FROM referral_partners WHERE access_token = $1',
    [token],
  )
  const partner = partnerResult.rows[0]
  if (!partner) return null
  const orders = await queryOrders(pool, partner.id)
  return { ...aggregateStats(partner, orders), orders: orders.map((row) => toOrderSummary(row, partner.commission_percent)) }
}
