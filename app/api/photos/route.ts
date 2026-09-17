import { DEMO_CLEANING_ID } from '@/lib/data/cleanings'
import { uploadCleaningPhoto } from '@/lib/data/photos'
import { isPhotoType, MAX_PHOTO_BYTES } from '@/lib/photo-upload'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const fail = (status: number) => Response.json({ error: 'Не удалось загрузить фото' }, { status })
  const type = request.headers.get('content-type') || ''
  if (!isPhotoType(type)) return fail(415)
  if (Number(request.headers.get('content-length')) > MAX_PHOTO_BYTES) return fail(413)
  if (!request.body) return fail(400)
  try {
    // Bound memory even for chunked requests without Content-Length.
    const reader = request.body.getReader()
    const chunks: Buffer[] = []
    let size = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_PHOTO_BYTES) {
          await reader.cancel()
          return fail(413)
        }
        chunks.push(Buffer.from(value))
      }
    } finally {
      reader.releaseLock()
    }
    const serviceId = new URL(request.url).searchParams.get('cleaning_service_id')
    const photo = await uploadCleaningPhoto(DEMO_CLEANING_ID, serviceId, Buffer.concat(chunks), type)
    return Response.json(photo, { status: 201 })
  } catch {
    return fail(400)
  }
}
