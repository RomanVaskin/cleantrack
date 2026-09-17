import 'server-only'
import convert from 'heic-convert'
import { constants } from 'node:fs'
import { mkdir, open, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { MAX_PHOTO_BYTES, PHOTO_TYPES, isPhotoType } from '@/lib/photo-upload'

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i

function photoPath(name: string) {
  if (!FILE_PATTERN.test(name)) throw new Error('Invalid storage identifier')
  const configured = process.env.CLEANTRACK_UPLOAD_DIR
  if (!configured && process.env.NODE_ENV === 'production') throw new Error('Upload directory required')
  return join(resolve(/* turbopackIgnore: true */ configured || join(tmpdir(), 'cleantrack-photos')), name)
}

export async function savePhoto(bytes: Buffer, type: string): Promise<string> {
  if (!isPhotoType(type) || !bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('Invalid photo')
  if (type === 'image/heic' || type === 'image/heif') {
    try {
      bytes = Buffer.from(await convert({ buffer: bytes, format: 'JPEG', quality: 0.85 }))
    } catch {
      // Never propagate decoder messages that could contain input data.
      throw new Error('HEIC conversion failed')
    }
    type = 'image/jpeg'
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('Converted photo too large')
  }
  // Keep existing signature checks for browser-native formats and converted JPEGs.
  const matches = type === 'image/jpeg'
    ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : type === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!matches) throw new Error('Invalid image signature')
  if (!isPhotoType(type)) throw new Error('Invalid photo')
  const name = `${randomUUID()}.${PHOTO_TYPES[type]}`
  const destination = photoPath(name)
  await mkdir(resolve(destination, '..'), { recursive: true, mode: 0o700 })
  const file = await open(/* turbopackIgnore: true */ destination, 'wx', 0o600)
  try {
    await file.writeFile(bytes)
  } catch (error) {
    await unlink(destination).catch(() => {})
    throw error
  } finally {
    await file.close()
  }
  return name
}

export async function removeStoredPhoto(name: string) {
  await unlink(photoPath(name))
}

export async function readStoredPhoto(name: string) {
  const file = await open(/* turbopackIgnore: true */ photoPath(name), constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size > MAX_PHOTO_BYTES) throw new Error('Invalid file')
    const bytes = await file.readFile()
    const extension = name.split('.').pop()?.toLowerCase()
    const type = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`
    return { bytes, type }
  } finally {
    await file.close()
  }
}
