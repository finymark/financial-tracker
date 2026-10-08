export const ATTACHMENT_MAX_SOURCE_BYTES = 25 * 1024 * 1024

export type AttachmentMediaType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export interface StagedAttachment {
  originalFileName: string
  storedName: string
  mediaType: AttachmentMediaType
  byteSize: number
}

export interface Attachment extends StagedAttachment {
  id: string
  transactionId: string
  position: number
  createdAt: string
}

export interface AttachmentIdInput {
  id: string
}

export interface AttachmentTransactionInput {
  transactionId: string
}

export interface ImportAttachmentInput {
  path: string
}

export interface AttachAttachmentInput {
  transactionId: string
  attachment: StagedAttachment
}

export type OpenAttachmentInput =
  | { id: string; attachment?: never }
  | { id?: never; attachment: StagedAttachment }
