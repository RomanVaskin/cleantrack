import type { CleaningStatus } from '@/lib/types'

export const cleaningStatusLabels: Record<CleaningStatus, string> = {
  in_progress: 'В процессе',
  completed: 'Завершена',
  accepted: 'Принята клиентом',
}

export function getCleaningStatusLabel(status: CleaningStatus): string {
  return cleaningStatusLabels[status]
}
