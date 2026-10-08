import type { AttachmentMediaType } from '../shared/attachments'

export interface DetectedAttachmentType {
  mediaType: AttachmentMediaType
  extension: 'jpg' | 'png' | 'webp' | 'pdf'
}

export function detectAttachmentFileType(
  value: Uint8Array,
): DetectedAttachmentType | null {
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return { mediaType: 'image/jpeg', extension: 'jpg' }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mediaType: 'image/png', extension: 'png' }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return { mediaType: 'image/webp', extension: 'webp' }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-')
    return { mediaType: 'application/pdf', extension: 'pdf' }
  return null
}
