declare module 'heic-convert' {
  export default function convert(options: {
    buffer: Uint8Array
    format: 'JPEG'
    quality: number
  }): Promise<ArrayBuffer>
}
