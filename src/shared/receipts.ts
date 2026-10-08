import type { ReceiptCurrency } from './receipt-parser'
import type { CreateTransactionInput, Transaction } from './transactions'

export type ReceiptStatus = 'received' | 'read' | 'confirmed' | 'discarded'
export type ReceiptSource = 'drop' | 'folder' | 'phone'

export interface Receipt {
  id: string
  status: ReceiptStatus
  storedName: string
  originalFileName: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  byteSize: number
  source: ReceiptSource
  receivedAt: string
  ocrPayeeName: string | null
  ocrDate: string | null
  ocrTotalMinor: number | null
  ocrCurrency: ReceiptCurrency | null
  ocrConfidence: number | null
  createdTransactionId: string | null
}

export type ReceiptIntake =
  | { path: string; bytes?: never; name?: never }
  | { path?: never; bytes: Uint8Array; name: string }

export interface IntakeReceiptInput {
  intake: ReceiptIntake
  source: ReceiptSource
}

export interface ReceiptIdInput {
  id: string
}

export interface ReceiptPrefill {
  accountId: string
  payeeName: string
  date: string
  totalMinor: number | null
  detectedCurrency: ReceiptCurrency | null
  currencyAccountMismatch: boolean
  categoryId: string
  tagNames: string[]
  confidence: 'high' | 'low'
}

export interface ReceiptPreviewInput extends ReceiptIdInput {
  thumbnail?: boolean
}

export interface ConfirmReceiptInput extends ReceiptIdInput {
  transaction: Omit<CreateTransactionInput, 'stagedAttachments'>
}

export interface ConfirmedReceipt {
  receipt: Receipt
  transaction: Transaction
}
