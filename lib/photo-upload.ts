export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export function isPhotoType(type: string): type is keyof typeof PHOTO_TYPES {
  return Object.hasOwn(PHOTO_TYPES, type)
}

export async function uploadCleaningPhoto(file: File, cleaningServiceId: string | null) {
  if (!isPhotoType(file.type) || !file.size || file.size > MAX_PHOTO_BYTES) {
    throw new Error('Invalid photo')
  }
  const query = cleaningServiceId ? `?cleaning_service_id=${encodeURIComponent(cleaningServiceId)}` : ''
  const response = await fetch(`/api/photos${query}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) throw new Error('Upload failed')
  return await response.json() as import('@/lib/types').Photo
}
