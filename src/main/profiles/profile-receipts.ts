import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type Database from 'better-sqlite3'
import sharp from 'sharp'
import type {
  Receipt,
  ReceiptPrefill,
  ReceiptSource,
  ReceiptStatus,
} from '../../shared/receipts'
import type { ReadReceiptResult } from '../ocr/read-receipt'
import { UUID_PATTERN } from '../../shared/validation'
import {
  attachmentStoredPath,
  type StoredImageAttachment,
} from './profile-attachments'
import { findPayeeByName } from './profile-payees'
import { getCategorisationAutofill } from './profile-rules'

interface StoredReceipt extends Omit<Receipt, 'status'> {
  status: ReceiptStatus
}

const SELECT_RECEIPT = `SELECT id, status, stored_name AS storedName,
  original_file_name AS originalFileName, media_type AS mediaType,
  byte_size AS byteSize, source, received_at AS receivedAt,
  ocr_payee_name AS ocrPayeeName, ocr_date AS ocrDate,
  ocr_total_minor AS ocrTotalMinor, ocr_currency AS ocrCurrency,
  ocr_confidence AS ocrConfidence,
  created_transaction_id AS createdTransactionId
  FROM receipt_inbox_items`

export function validateReceiptId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new Error('receipts.error.notFound')
  return value
}

export function validateReceiptSource(value: unknown): ReceiptSource {
  if (value !== 'drop' && value !== 'folder' && value !== 'phone')
    throw new Error('receipts.error.source')
  return value
}

export function getReceipt(database: Database.Database, id: string): Receipt {
  const receipt = database
    .prepare(`${SELECT_RECEIPT} WHERE id = ?`)
    .get(validateReceiptId(id)) as StoredReceipt | undefined
  if (!receipt) throw new Error('receipts.error.notFound')
  return receipt
}

export function listReceipts(database: Database.Database): Receipt[] {
  return database
    .prepare(
      `${SELECT_RECEIPT}
       WHERE status IN ('received', 'read')
       ORDER BY received_at, rowid`,
    )
    .all() as Receipt[]
}

export function listReceivedReceiptIds(database: Database.Database): string[] {
  return (
    database
      .prepare(
        `SELECT id FROM receipt_inbox_items
         WHERE status = 'received' ORDER BY received_at, rowid`,
      )
      .all() as { id: string }[]
  ).map(({ id }) => id)
}

export function getReceiptInboxCount(database: Database.Database): number {
  return (
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM receipt_inbox_items WHERE status IN ('received', 'read')",
      )
      .get() as { count: number }
  ).count
}

export function getReceiptDefaultAccountId(
  database: Database.Database,
): string | null {
  const account = database
    .prepare(
      `SELECT accounts.id
       FROM accounts
       WHERE accounts.archived = 0
       ORDER BY CASE WHEN accounts.id = (
         SELECT transactions.account_id
         FROM transactions
         JOIN accounts AS used_accounts
           ON used_accounts.id = transactions.account_id
         WHERE used_accounts.archived = 0
         ORDER BY transactions.created_at DESC, transactions.rowid DESC
         LIMIT 1
       ) THEN 0 ELSE 1 END,
       accounts.created_at, accounts.rowid
       LIMIT 1`,
    )
    .get() as { id: string } | undefined
  return account?.id ?? null
}

function getReceiptAccountIdForCurrency(
  database: Database.Database,
  currency: Receipt['ocrCurrency'],
): string | null {
  if (!currency) return null
  const account = database
    .prepare(
      `SELECT accounts.id
       FROM accounts
       WHERE accounts.archived = 0 AND accounts.currency = ?
       ORDER BY CASE WHEN accounts.id = (
         SELECT transactions.account_id
         FROM transactions
         JOIN accounts AS used_accounts
           ON used_accounts.id = transactions.account_id
         WHERE used_accounts.archived = 0 AND used_accounts.currency = ?
         ORDER BY transactions.created_at DESC, transactions.rowid DESC
         LIMIT 1
       ) THEN 0 ELSE 1 END,
       accounts.created_at, accounts.rowid
       LIMIT 1`,
    )
    .get(currency, currency) as { id: string } | undefined
  return account?.id ?? null
}

export function getReceiptPrefill(
  database: Database.Database,
  id: string,
): ReceiptPrefill {
  const receipt = getReceipt(database, id)
  const defaultAccountId = getReceiptDefaultAccountId(database) ?? ''
  const defaultAccount = defaultAccountId
    ? (database
        .prepare('SELECT currency FROM accounts WHERE id = ?')
        .get(defaultAccountId) as { currency: 'HUF' | 'CHF' })
    : null
  const currencyAccountId = getReceiptAccountIdForCurrency(
    database,
    receipt.ocrCurrency,
  )
  const accountId =
    receipt.ocrCurrency && defaultAccount?.currency !== receipt.ocrCurrency
      ? (currencyAccountId ?? defaultAccountId)
      : defaultAccountId
  const account = accountId
    ? (database
        .prepare('SELECT currency FROM accounts WHERE id = ?')
        .get(accountId) as { currency: 'HUF' | 'CHF' })
    : null
  const canonicalPayee = findPayeeByName(database, receipt.ocrPayeeName)
  const autofill = account
    ? getCategorisationAutofill(database, {
        accountId,
        kind: 'expense',
        totalMinor:
          receipt.ocrCurrency === account.currency
            ? receipt.ocrTotalMinor
            : null,
        payeeName: receipt.ocrPayeeName,
        note: '',
      })
    : null
  return {
    accountId,
    payeeName:
      canonicalPayee?.name ??
      receipt.ocrPayeeName ??
      (autofill?.source === 'rule' ? (autofill.payeeName ?? '') : ''),
    date: receipt.ocrDate ?? '',
    totalMinor: receipt.ocrTotalMinor,
    detectedCurrency: receipt.ocrCurrency,
    currencyAccountMismatch: Boolean(
      receipt.ocrCurrency && account?.currency !== receipt.ocrCurrency,
    ),
    categoryId: autofill?.categoryId ?? '',
    tagNames: autofill?.tags.map((tag) => tag.name) ?? [],
    confidence: receipt.ocrConfidence === 1 ? 'high' : 'low',
  }
}

export function setReceiptOcrResult(
  database: Database.Database,
  id: string,
  result: ReadReceiptResult,
): Receipt | null {
  const receipt = getReceipt(database, id)
  if (receipt.status !== 'received') return null
  database
    .prepare(
      `UPDATE receipt_inbox_items
       SET status = 'read', ocr_payee_name = ?, ocr_date = ?,
         ocr_total_minor = ?, ocr_currency = ?, ocr_confidence = ?
       WHERE id = ? AND status = 'received'`,
    )
    .run(
      result.payeeName ?? null,
      result.date ?? null,
      result.total ?? null,
      result.currency ?? null,
      result.confidence === 'high' ? 1 : 0,
      receipt.id,
    )
  return getReceipt(database, receipt.id)
}

export function insertReceipt(
  database: Database.Database,
  attachment: StoredImageAttachment,
  source: ReceiptSource,
  clock: () => Date,
): Receipt {
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO receipt_inbox_items
       (id, status, stored_name, original_file_name, media_type, byte_size,
        source, received_at)
       VALUES (?, 'received', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      attachment.storedName,
      attachment.originalFileName,
      attachment.mediaType,
      attachment.byteSize,
      validateReceiptSource(source),
      clock().toISOString(),
    )
  return getReceipt(database, id)
}

export function setReceiptDecision(
  database: Database.Database,
  id: string,
  status: 'confirmed' | 'discarded',
  transactionId: string | null,
): Receipt {
  const receipt = getReceipt(database, id)
  if (receipt.status !== 'received' && receipt.status !== 'read')
    throw new Error('receipts.error.notFound')
  database
    .prepare(
      'UPDATE receipt_inbox_items SET status = ?, created_transaction_id = ? WHERE id = ?',
    )
    .run(status, transactionId, receipt.id)
  return getReceipt(database, receipt.id)
}

export function restoreReceiptState(
  database: Database.Database,
  receipt: Receipt,
): void {
  database
    .prepare(
      'UPDATE receipt_inbox_items SET status = ?, created_transaction_id = ? WHERE id = ?',
    )
    .run(receipt.status, receipt.createdTransactionId, receipt.id)
}

export async function renderReceiptPreview(
  database: Database.Database,
  id: string,
  storeDirectory: string,
  thumbnail: boolean,
): Promise<string> {
  const receipt = getReceipt(database, id)
  let bytes: Buffer
  try {
    bytes = await sharp(
      readFileSync(attachmentStoredPath(storeDirectory, receipt.storedName)),
    )
      .rotate()
      .resize({
        width: thumbnail ? 240 : 1200,
        height: thumbnail ? 180 : 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: thumbnail ? 70 : 82 })
      .toBuffer()
  } catch (error) {
    throw new Error('receipts.error.preview', { cause: error })
  }
  return `data:image/jpeg;base64,${bytes.toString('base64')}`
}
