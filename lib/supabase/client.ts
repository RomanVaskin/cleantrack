import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Браузерный клиент Supabase для анонимного чтения (без Auth).
 * null, если переменные окружения не заданы. Пока не используется
 * ни одной страницей — задел под будущие client-side сценарии.
 */
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
