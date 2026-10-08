import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, isAbsolute, join, parse } from 'node:path'
import type Database from 'better-sqlite3'
import sharp, { type Metadata } from 'sharp'
import {
  ATTACHMENT_MAX_SOURCE_BYTES,
  type Attachment,
  type AttachmentMediaType,
  type StagedAttachment,
} from '../../shared/attachments'
import type { ReceiptIntake } from '../../shared/receipts'
import { validateTransactionId } from './transaction-validation'

interface DetectedType {
  mediaType: AttachmentMediaType
  extension: 'jpg' | 'png' | 'webp' | 'pdf'
}

const STORED_NAME_PATTERN = /^([0-9a-f]{64})\.(jpg|png|webp|pdf)$/
const mediaTypesByExtension: Record<
  DetectedType['extension'],
  AttachmentMediaType
> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

function hasAttachmentTable(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'attachments'",
      )
      .get(),
  )
}

function hasReceiptInboxTable(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'receipt_inbox_items'",
      )
      .get(),
  )
}

function referencedStoredNames(database: Database.Database): string[] {
  const receiptUnion = hasReceiptInboxTable(database)
    ? `UNION
       SELECT stored_name FROM receipt_inbox_items
       WHERE status IN ('received', 'read')`
    : ''
  return (
    database
      .prepare(
        `SELECT stored_name AS storedName FROM attachments ${receiptUnion}`,
      )
      .all() as { storedName: string }[]
  ).map(({ storedName }) => storedName)
}

export function attachmentDirectory(dataDirectory: string): string {
  return join(dataDirectory, 'attachments')
}

function detectType(bytes: Buffer): DetectedType {
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
  throw new Error('attachments.error.type')
}

async function processImage(
  bytes: Buffer,
  type: DetectedType,
): Promise<Buffer> {
  if (type.mediaType === 'application/pdf') return bytes
  let metadata: Metadata
  try {
    metadata = await sharp(bytes).metadata()
  } catch (error) {
    throw new Error('attachments.error.type', { cause: error })
  }
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (width < 1 || height < 1) throw new Error('attachments.error.type')
  const orientation = metadata.orientation ?? 1
  if (Math.max(width, height) <= 2000 && orientation === 1) return bytes
  let pipeline = sharp(bytes).rotate().resize({
    width: 2000,
    height: 2000,
    fit: 'inside',
    withoutEnlargement: true,
  })
  if (type.extension === 'jpg') pipeline = pipeline.jpeg({ quality: 85 })
  else if (type.extension === 'png') pipeline = pipeline.png()
  else pipeline = pipeline.webp()
  try {
    return await pipeline.toBuffer()
  } catch (error) {
    throw new Error('attachments.error.type', { cause: error })
  }
}

function atomicStore(directory: string, name: string, bytes: Buffer): void {
  mkdirSync(directory, { recursive: true })
  const destination = join(directory, name)
  if (existsSync(destination)) return
  const temporary = join(directory, `.${name}.${randomUUID()}.tmp`)
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' })
    if (existsSync(destination)) return
    renameSync(temporary, destination)
  } catch (error) {
    if (!existsSync(destination))
      throw new Error('attachments.error.store', { cause: error })
  } finally {
    rmSync(temporary, { force: true })
  }
}

export async function importAttachment(
  source: string | ReceiptIntake,
  directory: string,
): Promise<StagedAttachment> {
  if (typeof source !== 'string' && source.path === undefined) {
    return importAttachmentBytes(source.bytes, source.name, directory)
  }
  const sourcePath = typeof source === 'string' ? source : source.path
  if (
    typeof sourcePath !== 'string' ||
    !isAbsolute(sourcePath) ||
    sourcePath.includes('\0')
  )
    throw new Error('attachments.error.path')
  let size: number
  try {
    const source = statSync(sourcePath)
    if (!source.isFile()) throw new Error('not a file')
    size = source.size
  } catch (error) {
    throw new Error('attachments.error.path', { cause: error })
  }
  if (size > ATTACHMENT_MAX_SOURCE_BYTES)
    throw new Error('attachments.error.size')
  let sourceBytes: Buffer
  try {
    sourceBytes = readFileSync(sourcePath)
  } catch (error) {
    throw new Error('attachments.error.path', { cause: error })
  }
  if (sourceBytes.length > ATTACHMENT_MAX_SOURCE_BYTES)
    throw new Error('attachments.error.size')
  const type = detectType(sourceBytes)
  return storeImportedAttachment(
    sourceBytes,
    basename(sourcePath),
    type,
    directory,
  )
}

async function importAttachmentBytes(
  value: Uint8Array,
  name: string,
  directory: string,
): Promise<StagedAttachment> {
  if (
    !(value instanceof Uint8Array) ||
    typeof name !== 'string' ||
    name.length < 1 ||
    name.length > 255 ||
    name.includes('\0') ||
    basename(name) !== name ||
    name === '.' ||
    name === '..'
  )
    throw new Error('attachments.error.path')
  if (value.byteLength > ATTACHMENT_MAX_SOURCE_BYTES)
    throw new Error('attachments.error.size')
  const bytes = Buffer.from(value)
  const type = detectType(bytes)
  return storeImportedAttachment(bytes, name, type, directory)
}

async function storeImportedAttachment(
  sourceBytes: Buffer,
  originalFileName: string,
  type: DetectedType,
  directory: string,
): Promise<StagedAttachment> {
  if (
    originalFileName.length < 1 ||
    originalFileName.length > 255 ||
    originalFileName.includes('\0') ||
    basename(originalFileName) !== originalFileName ||
    originalFileName === '.' ||
    originalFileName === '..'
  )
    throw new Error('attachments.error.path')
  const storedBytes = await processImage(sourceBytes, type)
  const hash = createHash('sha256').update(storedBytes).digest('hex')
  const storedName = `${hash}.${type.extension}`
  atomicStore(directory, storedName, storedBytes)
  return {
    originalFileName,
    storedName,
    mediaType: type.mediaType,
    byteSize: storedBytes.length,
  }
}

export type StoredImageAttachment = StagedAttachment & {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export async function importReceiptPhoto(
  source: ReceiptIntake,
  directory: string,
): Promise<StoredImageAttachment> {
  let attachment: StagedAttachment
  try {
    attachment = await importAttachment(source, directory)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'attachments.error.size')
      throw new Error('receipts.error.size', { cause: error })
    if (message === 'attachments.error.path')
      throw new Error('receipts.error.path', { cause: error })
    throw new Error('receipts.error.type', { cause: error })
  }
  if (attachment.mediaType === 'application/pdf')
    throw new Error('receipts.error.type')
  return attachment as StoredImageAttachment
}

export function validateStagedAttachment(
  value: StagedAttachment,
  directory: string,
): StagedAttachment {
  if (!value || typeof value !== 'object')
    throw new Error('attachments.error.staged')
  const { originalFileName, storedName, mediaType, byteSize } = value
  const match =
    typeof storedName === 'string' ? STORED_NAME_PATTERN.exec(storedName) : null
  if (
    typeof originalFileName !== 'string' ||
    originalFileName.length < 1 ||
    originalFileName.length > 255 ||
    originalFileName.includes('\0') ||
    basename(originalFileName) !== originalFileName ||
    originalFileName === '.' ||
    originalFileName === '..' ||
    !match ||
    mediaTypesByExtension[match[2] as DetectedType['extension']] !==
      mediaType ||
    !Number.isSafeInteger(byteSize) ||
    byteSize < 1
  )
    throw new Error('attachments.error.staged')
  const path = join(directory, storedName)
  try {
    const stats = statSync(path)
    if (!stats.isFile() || stats.size !== byteSize)
      throw new Error('invalid stored file')
    const bytes = readFileSync(path)
    if (createHash('sha256').update(bytes).digest('hex') !== match[1])
      throw new Error('stored hash mismatch')
    if (detectType(bytes).mediaType !== mediaType)
      throw new Error('stored media type mismatch')
  } catch (error) {
    throw new Error('attachments.error.staged', { cause: error })
  }
  return { originalFileName, storedName, mediaType, byteSize }
}

export function listAttachments(
  database: Database.Database,
  transactionId: string,
): Attachment[] {
  if (!hasAttachmentTable(database)) return []
  return database
    .prepare(
      `SELECT id, transaction_id AS transactionId,
        original_file_name AS originalFileName, stored_name AS storedName,
        media_type AS mediaType, byte_size AS byteSize, position,
        created_at AS createdAt
       FROM attachments WHERE transaction_id = ? ORDER BY position, id`,
    )
    .all(validateTransactionId(transactionId)) as Attachment[]
}

export function getAttachment(
  database: Database.Database,
  id: string,
): Attachment {
  const attachment = database
    .prepare(
      `SELECT id, transaction_id AS transactionId,
        original_file_name AS originalFileName, stored_name AS storedName,
        media_type AS mediaType, byte_size AS byteSize, position,
        created_at AS createdAt FROM attachments WHERE id = ?`,
    )
    .get(id) as Attachment | undefined
  if (!attachment) throw new Error('attachments.error.notFound')
  return attachment
}

export function insertAttachment(
  database: Database.Database,
  transactionId: string,
  staged: StagedAttachment,
  directory: string,
  clock: () => Date,
  position?: number,
): Attachment {
  const id = randomUUID()
  const validatedId = validateTransactionId(transactionId)
  if (
    !database
      .prepare('SELECT 1 FROM transactions WHERE id = ?')
      .get(validatedId)
  )
    throw new Error('transactions.error.notFound')
  const attachment = validateStagedAttachment(staged, directory)
  const nextPosition =
    position ??
    (
      database
        .prepare(
          'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM attachments WHERE transaction_id = ?',
        )
        .get(validatedId) as { position: number }
    ).position
  const createdAt = clock().toISOString()
  database
    .prepare(
      `INSERT INTO attachments
       (id, transaction_id, original_file_name, stored_name, media_type,
        byte_size, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      validatedId,
      attachment.originalFileName,
      attachment.storedName,
      attachment.mediaType,
      attachment.byteSize,
      nextPosition,
      createdAt,
    )
  return getAttachment(database, id)
}

export function removeAttachment(
  database: Database.Database,
  id: string,
): void {
  const attachment = getAttachment(database, id)
  database.prepare('DELETE FROM attachments WHERE id = ?').run(attachment.id)
}

export function restoreAttachment(
  database: Database.Database,
  attachment: Attachment,
): void {
  database
    .prepare(
      `INSERT INTO attachments
       (id, transaction_id, original_file_name, stored_name, media_type,
        byte_size, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      attachment.id,
      attachment.transactionId,
      attachment.originalFileName,
      attachment.storedName,
      attachment.mediaType,
      attachment.byteSize,
      attachment.position,
      attachment.createdAt,
    )
}

function availableCopyName(directory: string, original: string): string {
  const parts = parse(original)
  for (let number = 1; ; number += 1) {
    const name =
      number === 1 ? original : `${parts.name} (${number})${parts.ext}`
    if (!existsSync(join(directory, name))) return name
  }
}

export function copyAttachments(
  attachments: readonly Attachment[],
  storeDirectory: string,
  destinationDirectory: string,
): void {
  if (
    typeof destinationDirectory !== 'string' ||
    !isAbsolute(destinationDirectory)
  )
    throw new Error('attachments.error.copy')
  try {
    mkdirSync(destinationDirectory, { recursive: true })
    if (!statSync(destinationDirectory).isDirectory())
      throw new Error('not a directory')
    for (const attachment of attachments) {
      const name = availableCopyName(
        destinationDirectory,
        attachment.originalFileName,
      )
      copyFileSync(
        join(storeDirectory, attachment.storedName),
        join(destinationDirectory, name),
      )
    }
  } catch (error) {
    throw new Error('attachments.error.copy', { cause: error })
  }
}

export function sweepUnreferencedAttachments(
  database: Database.Database,
  directory: string,
): void {
  if (!hasAttachmentTable(database)) return
  mkdirSync(directory, { recursive: true })
  const referenced = new Set(referencedStoredNames(database))
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      STORED_NAME_PATTERN.test(entry.name) &&
      !referenced.has(entry.name)
    )
      rmSync(join(directory, entry.name), { force: true })
  }
}

export function attachmentStoredPath(
  directory: string,
  storedName: string,
): string {
  if (!STORED_NAME_PATTERN.test(storedName))
    throw new Error('attachments.error.staged')
  return join(directory, storedName)
}

export function copyAttachmentForOpening(
  database: Database.Database,
  value: { id: string } | { attachment: StagedAttachment },
  storeDirectory: string,
  temporaryDirectory: string,
): string {
  const attachment =
    'id' in value
      ? getAttachment(database, value.id)
      : validateStagedAttachment(value.attachment, storeDirectory)
  const targetDirectory = join(temporaryDirectory, randomUUID())
  mkdirSync(targetDirectory, { recursive: true })
  const destination = join(targetDirectory, attachment.originalFileName)
  copyFileSync(join(storeDirectory, attachment.storedName), destination)
  return destination
}

export function storedAttachmentNames(database: Database.Database): string[] {
  if (!hasAttachmentTable(database)) return []
  return referencedStoredNames(database)
}
