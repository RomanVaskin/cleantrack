export const MAX_PHOTO_BYTES = 50 * 1024 * 1024

export function photoUploadError(status: number) {
  return status === 413 ? 'Фото слишком большое'
    : status === 415 ? 'Формат фото не поддерживается'
      : 'Не удалось загрузить фото'
}

export async function uploadCleaningPhoto(file: File, cleaningServiceId: string | null) {
  if (file.size > MAX_PHOTO_BYTES) throw new Error(photoUploadError(413))
  if (!file.size) throw new Error(photoUploadError(415))
  const query = cleaningServiceId ? `?cleaning_service_id=${encodeURIComponent(cleaningServiceId)}` : ''
  const response = await fetch(`/api/photos${query}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) throw new Error(photoUploadError(response.status))
  return await response.json() as import('@/lib/types').Photo
}
