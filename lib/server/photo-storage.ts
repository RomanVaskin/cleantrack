import 'server-only'
import convert from 'heic-convert'
import sharp from 'sharp'
import { constants } from 'node:fs'
import { mkdir, open, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { MAX_PHOTO_BYTES } from '@/lib/photo-upload'

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i

function photoPath(name: string) {
  if (!FILE_PATTERN.test(name)) throw new Error('Invalid storage identifier')
  const configured = process.env.CLEANTRACK_UPLOAD_DIR
  if (!configured && process.env.NODE_ENV === 'production') throw new Error('Upload directory required')
  return join(resolve(/* turbopackIgnore: true */ configured || join(tmpdir(), 'cleantrack-photos')), name)
}

export class PhotoInputError extends Error {
  constructor(public readonly status: 413 | 415) {
    super(status === 413 ? 'Source photo exceeds 50 MiB' : 'Unsupported or invalid image')
  }
}

// Inspect file signatures, never the filename or the supplied Content-Type.
function imageFormat(bytes: Buffer): 'native' | 'heic' | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'native'
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'native'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'native'
  if (bytes.length < 16 || bytes.toString('ascii', 4, 8) !== 'ftyp') return null
  const size = bytes.readUInt32BE(0)
  if (size < 16 || size > bytes.length || size % 4 !== 0) return null
  const brands = [bytes.toString('ascii', 8, 12)]
  for (let offset = 16; offset < size; offset += 4) brands.push(bytes.toString('ascii', offset, offset + 4))
  if (brands.some(brand => ['avif', 'avis'].includes(brand))) return 'native'
  if (brands.some(brand => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand))) return 'heic'
  return null
}

export async function savePhoto(bytes: Buffer): Promise<string> {
  if (bytes.length > MAX_PHOTO_BYTES) throw new PhotoInputError(413)
  const format = imageFormat(bytes)
  if (!format) throw new PhotoInputError(415)
  try {
    if (format === 'heic') {
      bytes = Buffer.from(await convert({ buffer: bytes, format: 'JPEG', quality: 1 }))
    }
    bytes = await sharp(bytes, { failOn: 'warning' })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer()
  } catch {
    // Do not propagate decoder messages or input data.
    throw new PhotoInputError(415)
  }
  const name = `${randomUUID()}.jpg`
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
