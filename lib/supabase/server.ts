import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null | undefined

/**
 * Серверный клиент Supabase для анонимного чтения данных (без Auth/cookies).
 * Возвращает null, если переменные окружения не заданы — вызывающий код
 * должен в этом случае откатиться на mock-данные.
 */
export function createSupabaseServerClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  cachedClient =
    url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null

  return cachedClient
}
