import { PhotoInputError, UUID_PATTERN } from '@/lib/server/photo-storage'
import { uploadCleaningPhoto } from '@/lib/data/photos'
import { photoUploadError, MAX_PHOTO_BYTES } from '@/lib/photo-upload'
import { isSectionCode } from '@/lib/checklist-sections'
import type { SectionCode } from '@/lib/types'

export const runtime = 'nodejs'

// Only fixed reasons and known system codes are logged, never arbitrary error messages,
// database details, request URLs, paths, credentials, or file contents.
function failureReason(error: unknown): string {
  const reasons = new Set([
    'Invalid target', 'Invalid photo', 'Invalid image signature',
    'HEIC conversion failed', 'Converted photo too large',
    'Upload directory required', 'Invalid storage identifier',
  ])
  if (error instanceof Error && reasons.has(error.message)) return error.message
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  if (typeof code === 'string' && /^(EACCES|EPERM|ENOSPC|ENOENT|EROFS|EMFILE|EIO|ECONNREFUSED|ECONNRESET|ETIMEDOUT|28P01|23503|23505|42P01|53300|57P01)$/.test(code)) {
    return `Storage/database error: ${code}`
  }
  return 'Unexpected upload error'
}

export async function POST(request: Request) {
  const fail = (status: number, reason: string) => {
    console.error('[photo-upload]', { status, reason })
    return Response.json({ error: photoUploadError(status) }, { status })
  }
  const params = new URL(request.url).searchParams
  const cleaningId = params.get('cleaning_id')
  const serviceId = params.get('cleaning_service_id')
  const sectionCodeParam = params.get('section_code')
  if (
    !cleaningId || !UUID_PATTERN.test(cleaningId)
    || (serviceId !== null && !UUID_PATTERN.test(serviceId))
    || (sectionCodeParam !== null && !isSectionCode(sectionCodeParam))
    || (serviceId !== null && sectionCodeParam !== null)
  ) {
    return fail(400, 'Invalid target')
  }
  const sectionCode: SectionCode | null = isSectionCode(sectionCodeParam) ? sectionCodeParam : null
  if (Number(request.headers.get('content-length')) > MAX_PHOTO_BYTES) return fail(413, 'Source photo exceeds 50 MiB')
  if (!request.body) return fail(400, 'Missing request body')
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
          return fail(413, 'Source photo exceeds 50 MiB')
        }
        chunks.push(Buffer.from(value))
      }
    } finally {
      reader.releaseLock()
    }
    const photo = await uploadCleaningPhoto(cleaningId, serviceId, sectionCode, Buffer.concat(chunks))
    return Response.json(photo, { status: 201 })
  } catch (error) {
    if (error instanceof PhotoInputError) return fail(error.status, error.message)
    return fail(400, failureReason(error))
  }
}
