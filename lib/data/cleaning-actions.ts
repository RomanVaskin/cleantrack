'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface WriteResult {
  ok: boolean
}

/**
 * Записывает отметку "выполнено" для пункта чек-листа (cleaning_services.id).
 * В mock-режиме (Supabase не настроен) ничего не пишет и считает запись
 * успешной — UI продолжает работать на локальном state, как раньше.
 */
export async function updateChecklistItem(itemId: string, isDone: boolean): Promise<WriteResult> {
  const supabase = createSupabaseServerClient()
  if (!supabase) return { ok: true }

  const { error } = await supabase
    .from('cleaning_services')
    .update({ is_done: isDone, completed_at: isDone ? new Date().toISOString() : null })
    .eq('id', itemId)

  return { ok: !error }
}

/** Записывает статус уборки как завершённый. Тот же mock-fallback, что и выше. */
export async function completeCleaning(cleaningId: string): Promise<WriteResult> {
  const supabase = createSupabaseServerClient()
  if (!supabase) return { ok: true }

  const { error } = await supabase
    .from('cleanings')
    .update({ status: 'completed' })
    .eq('id', cleaningId)

  return { ok: !error }
}
