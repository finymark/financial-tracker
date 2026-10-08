import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, test } from 'vitest'
import type { OcrEngine, OcrLanguage, OcrResult } from '../ocr/ocr-engine'
import {
  CURRENT_MIGRATIONS,
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry, type ProfilePaths } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
let now = new Date('2026-01-15T10:00:00.000Z')
const clock = () => now

class FakeOcrEngine implements OcrEngine {
  calls: { image: Buffer; languages: OcrLanguage[] }[] = []

  constructor(
    private readonly recognizeImplementation: () => Promise<OcrResult>,
  ) {}

  async recognize(image: Buffer, languages: OcrLanguage[]) {
    this.calls.push({ image, languages })
    return this.recognizeImplementation()
  }

  async dispose() {}
}

async function setup(
  createStartupBackup = false,
  ocrEngine?: OcrEngine,
  onReceiptInboxChanged?: () => void,
): Promise<{
  application: ProfileApplication
  paths: ProfilePaths
  profile: ReturnType<ProfileRegistry['createProfile']>
}> {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-receipts-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Receipt test')
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({
    profile,
    paths,
    clock,
    createStartupBackup,
    ocrEngine,
    onReceiptInboxChanged,
  })
  applications.push(application)
  return { application, paths, profile }
}

async function waitForReceipt(
  application: ProfileApplication,
  id: string,
  status: 'received' | 'read',
): Promise<ReturnType<ProfileApplication['queries']['listReceipts']>[number]> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const receipt = application.queries
      .listReceipts()
      .find((candidate) => candidate.id === id)
    if (receipt?.status === status) return receipt
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Receipt did not reach ${status}`)
}

async function image(
  format: 'jpeg' | 'png' | 'webp' = 'jpeg',
): Promise<Buffer> {
  return sharp({
    create: { width: 12, height: 8, channels: 3, background: '#4070a0' },
  })
    [format]()
    .toBuffer()
}

function close(application: ProfileApplication): void {
  application.close()
  applications.splice(applications.indexOf(application), 1)
}

afterEach(() => {
  now = new Date('2026-01-15T10:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('intakes receipt photos by path and bytes without touching undo history, and persists them oldest first', async () => {
  const context = await setup()
  const account = context.application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const jpeg = await image('jpeg')
  const source = join(context.paths.profileDirectory, 'first-photo.bin')
  writeFileSync(source, jpeg)

  const first = await context.application.commands.intakeReceipt(
    { path: source },
    'drop',
  )
  now = new Date('2026-01-15T10:01:00.000Z')
  const second = await context.application.commands.intakeReceipt(
    { bytes: await image('png'), name: 'second.png' },
    'phone',
  )

  expect(context.application.queries.listReceipts()).toEqual([first, second])
  expect(context.application.queries.getReceiptInboxCount()).toBe(2)
  expect(first).toMatchObject({
    status: 'received',
    originalFileName: 'first-photo.jpg',
    mediaType: 'image/jpeg',
    source: 'drop',
    receivedAt: '2026-01-15T10:00:00.000Z',
    ocrPayeeName: null,
    ocrDate: null,
    ocrTotalMinor: null,
    ocrCurrency: null,
    ocrConfidence: null,
    createdTransactionId: null,
  })
  expect(second).toMatchObject({
    originalFileName: 'second.png',
    mediaType: 'image/png',
    source: 'phone',
  })
  // Intake is a background write: the preceding account command remains undoable.
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listAccounts()).not.toContainEqual(account)
  expect(context.application.queries.listReceipts()).toHaveLength(2)

  close(context.application)
  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    createStartupBackup: false,
  })
  applications.push(reopened)
  expect(reopened.queries.listReceipts()).toEqual([first, second])
})

test('confirm creates one transaction with exactly the receipt photo and undo restores the inbox item', async () => {
  const context = await setup()
  const account = context.application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image('webp'), name: 'purchase.webp' },
    'folder',
  )

  const confirmed = context.application.commands.confirmReceipt({
    id: receipt.id,
    transaction: {
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 129900,
      payeeName: 'Synthetic Shop',
      categoryId: null,
      note: '',
    },
  })

  expect(context.application.queries.listReceipts()).toEqual([])
  expect(context.application.queries.getReceiptInboxCount()).toBe(0)
  expect(confirmed.receipt).toMatchObject({
    id: receipt.id,
    status: 'confirmed',
    createdTransactionId: confirmed.transaction.id,
  })
  expect(confirmed.transaction.attachments).toHaveLength(1)
  expect(confirmed.transaction.attachments[0]).toMatchObject({
    originalFileName: receipt.originalFileName,
    storedName: receipt.storedName,
    mediaType: receipt.mediaType,
    byteSize: receipt.byteSize,
  })

  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listTransactions().rows).toEqual([])
  expect(context.application.queries.listReceipts()).toEqual([receipt])
})

test('discard hides a receipt and undo returns it', async () => {
  const context = await setup()
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'discard.jpg' },
    'drop',
  )

  expect(context.application.commands.discardReceipt(receipt.id)).toMatchObject(
    {
      status: 'discarded',
    },
  )
  expect(context.application.queries.listReceipts()).toEqual([])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listReceipts()).toEqual([receipt])
})

test('intake accepts only JPEG, PNG, and WebP photos within 25 MB', async () => {
  const context = await setup()
  const pdf = join(context.paths.profileDirectory, 'document.pdf')
  const invalid = join(context.paths.profileDirectory, 'invalid.jpg')
  writeFileSync(pdf, '%PDF-1.7\nsynthetic\n%%EOF\n')
  writeFileSync(invalid, 'not an image')

  await expect(
    context.application.commands.intakeReceipt({ path: pdf }, 'drop'),
  ).rejects.toThrow('receipts.error.type')
  await expect(
    context.application.commands.intakeReceipt({ path: invalid }, 'drop'),
  ).rejects.toThrow('receipts.error.type')
  await expect(
    context.application.commands.intakeReceipt(
      { bytes: Buffer.alloc(25 * 1024 * 1024 + 1), name: 'large.jpg' },
      'phone',
    ),
  ).rejects.toThrow('receipts.error.size')
  expect(context.application.queries.listReceipts()).toEqual([])
})

test('profile sweep keeps active inbox content and removes it after discard and reopen', async () => {
  const context = await setup()
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'keep.jpg' },
    'drop',
  )
  const stored = join(
    context.paths.dataDirectory,
    'attachments',
    receipt.storedName,
  )
  close(context.application)

  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    createStartupBackup: false,
  })
  applications.push(reopened)
  expect(existsSync(stored)).toBe(true)
  reopened.commands.discardReceipt(receipt.id)
  close(reopened)

  const swept = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    createStartupBackup: false,
  })
  applications.push(swept)
  expect(existsSync(stored)).toBe(false)
})

test('startup backup pools active inbox content and restore brings a missing photo back', async () => {
  const context = await setup()
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image('png'), name: 'backup.png' },
    'phone',
  )
  close(context.application)

  const backedUp = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
  })
  applications.push(backedUp)
  const backup = backedUp.queries.listBackups()[0]
  const pooled = join(
    context.paths.backupDirectory,
    'attachments',
    receipt.storedName,
  )
  const live = join(
    context.paths.dataDirectory,
    'attachments',
    receipt.storedName,
  )
  expect(readFileSync(pooled)).toEqual(readFileSync(live))
  rmSync(live)

  await backedUp.commands.restoreBackup({
    backupId: backup.id,
    confirmed: true,
  })
  expect(readFileSync(live)).toEqual(readFileSync(pooled))
  expect(backedUp.queries.listReceipts()).toEqual([receipt])
})

test('renders receipt previews as downscaled JPEG data URLs', async () => {
  const context = await setup()
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image('webp'), name: 'preview.webp' },
    'drop',
  )
  const preview = await context.application.commands.renderReceiptPreview(
    receipt.id,
    true,
  )
  expect(preview).toMatch(/^data:image\/jpeg;base64,/)
  const metadata = await sharp(
    Buffer.from(preview.split(',')[1], 'base64'),
  ).metadata()
  expect(metadata.format).toBe('jpeg')
  expect(metadata.width).toBeLessThanOrEqual(240)
  expect(metadata.height).toBeLessThanOrEqual(180)
})

test('receipt form defaults to the last active account used by a transaction', async () => {
  const context = await setup()
  const first = context.application.commands.createAccount({
    name: 'First',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const lastUsed = context.application.commands.createAccount({
    name: 'Last used',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  expect(context.application.queries.getReceiptDefaultAccountId()).toBe(
    first.id,
  )
  context.application.commands.createTransaction({
    accountId: lastUsed.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(context.application.queries.getReceiptDefaultAccountId()).toBe(
    lastUsed.id,
  )
  context.application.commands.archiveAccount(lastUsed.id)
  expect(context.application.queries.getReceiptDefaultAccountId()).toBe(
    first.id,
  )
})

test('intake queues OCR, stores parsed fields without touching undo history, and notifies', async () => {
  let notifications = 0
  const engine = new FakeOcrEngine(async () => ({
    text: 'MINTA OCR Kft.\nFIZETENDŐ 1 234 Ft\n2026. 01. 15.',
    confidence: 94,
  }))
  const context = await setup(false, engine, () => {
    notifications += 1
  })
  const account = context.application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'ocr.jpg' },
    'drop',
  )
  const read = await waitForReceipt(context.application, receipt.id, 'read')

  expect(read).toMatchObject({
    status: 'read',
    ocrPayeeName: 'MINTA OCR Kft.',
    ocrDate: '2026-01-15',
    ocrTotalMinor: 123_400,
    ocrCurrency: 'HUF',
    ocrConfidence: 1,
  })
  expect(engine.calls).toHaveLength(1)
  expect(engine.calls[0].languages).toEqual(['eng'])
  expect(notifications).toBeGreaterThanOrEqual(2)
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listAccounts()).not.toContainEqual(account)
  expect(context.application.queries.listReceipts()[0].status).toBe('read')
})

test('OCR failure still marks a receipt read with empty low-confidence fields', async () => {
  const engine = new FakeOcrEngine(async () => {
    throw new Error('synthetic OCR failure')
  })
  const context = await setup(false, engine)
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'failure.jpg' },
    'drop',
  )
  await expect(
    waitForReceipt(context.application, receipt.id, 'read'),
  ).resolves.toMatchObject({
    status: 'read',
    ocrPayeeName: null,
    ocrDate: null,
    ocrTotalMinor: null,
    ocrCurrency: null,
    ocrConfidence: 0,
  })
})

test('closing a profile cancels a pending OCR result before it can write', async () => {
  let recognizeStarted!: () => void
  const started = new Promise<void>((resolve) => {
    recognizeStarted = resolve
  })
  let finishRecognition!: (result: OcrResult) => void
  const recognition = new Promise<OcrResult>((resolve) => {
    finishRecognition = resolve
  })
  const engine = new FakeOcrEngine(async () => {
    recognizeStarted()
    return recognition
  })
  const context = await setup(false, engine)
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'pending.jpg' },
    'drop',
  )
  await started
  close(context.application)
  finishRecognition({
    text: 'LATE TEST AG\nTOTAL CHF 12.50\n15.01.2026',
    confidence: 90,
  })
  await recognition

  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    createStartupBackup: false,
  })
  applications.push(reopened)
  await expect(
    waitForReceipt(reopened, receipt.id, 'received'),
  ).resolves.toMatchObject({
    ocrPayeeName: null,
  })
})

test('opening a profile requeues received receipts', async () => {
  const context = await setup()
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'requeue.jpg' },
    'drop',
  )
  close(context.application)
  const engine = new FakeOcrEngine(async () => ({
    text: 'REOPEN TEST AG\nTOTAL CHF 9.90\n15.01.2026',
    confidence: 90,
  }))
  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    createStartupBackup: false,
    ocrEngine: engine,
  })
  applications.push(reopened)
  await expect(
    waitForReceipt(reopened, receipt.id, 'read'),
  ).resolves.toMatchObject({
    ocrPayeeName: 'REOPEN TEST AG',
    ocrTotalMinor: 990,
  })
})

test('receipt prefill resolves an OCR payee alias before rule suggestions', async () => {
  const engine = new FakeOcrEngine(async () => ({
    text: 'RAW OCR SHOP\nÖSSZESEN 2 500 Ft\n2026. 01. 15.',
    confidence: 92,
  }))
  const context = await setup(false, engine)
  const account = context.application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const category = context.application.commands.createCategory({
    kind: 'expense',
    name: 'OCR category',
    parentId: null,
  })
  const canonical = context.application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: 100,
    payeeName: 'Canonical Shop',
    categoryId: null,
    note: '',
    tagNames: ['OCR tag'],
  })
  context.application.commands.addPayeeAlias({
    payeeId: canonical.payeeId!,
    name: 'RAW OCR SHOP',
  })
  const tag = context.application.queries.listTags()[0]
  context.application.commands.createCategorisationRule({
    enabled: true,
    payeeId: canonical.payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: category.id,
    tagIds: [tag.id],
  })
  const receipt = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'alias.jpg' },
    'drop',
  )
  await waitForReceipt(context.application, receipt.id, 'read')

  expect(context.application.queries.getReceiptPrefill(receipt.id)).toEqual({
    accountId: account.id,
    payeeName: 'Canonical Shop',
    date: '2026-01-15',
    totalMinor: 250_000,
    detectedCurrency: 'HUF',
    currencyAccountMismatch: false,
    categoryId: category.id,
    tagNames: ['OCR tag'],
    confidence: 'high',
  })
})

test('receipt prefill selects the last-used matching-currency account or reports no match', async () => {
  const results = [
    'SWISS TEST AG\nTOTAL CHF 12.50\n15.01.2026',
    'EURO TEST GmbH\nSUMME EUR 9,90\n15.01.2026',
  ]
  const engine = new FakeOcrEngine(async () => ({
    text: results.shift()!,
    confidence: 90,
  }))
  const context = await setup(false, engine)
  const firstChf = context.application.commands.createAccount({
    name: 'First CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const lastUsedChf = context.application.commands.createAccount({
    name: 'Last CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const huf = context.application.commands.createAccount({
    name: 'Default HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  context.application.commands.createTransaction({
    accountId: firstChf.id,
    kind: 'expense',
    date: '2026-01-13',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  context.application.commands.createTransaction({
    accountId: lastUsedChf.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  context.application.commands.createTransaction({
    accountId: huf.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })

  const swiss = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'swiss.jpg' },
    'drop',
  )
  await waitForReceipt(context.application, swiss.id, 'read')
  expect(context.application.queries.getReceiptPrefill(swiss.id)).toMatchObject(
    {
      accountId: lastUsedChf.id,
      detectedCurrency: 'CHF',
      currencyAccountMismatch: false,
    },
  )

  const euro = await context.application.commands.intakeReceipt(
    { bytes: await image(), name: 'euro.jpg' },
    'drop',
  )
  await waitForReceipt(context.application, euro.id, 'read')
  expect(context.application.queries.getReceiptPrefill(euro.id)).toMatchObject({
    accountId: huf.id,
    detectedCurrency: 'EUR',
    currencyAccountMismatch: true,
  })
})

test('EUR OCR migration preserves receipts created by the inbox schema', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-receipts-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Receipt migration test')
  const paths = registry.getProfilePaths(profile.id)
  const previous = await openProfileApplication({
    profile,
    paths,
    clock,
    createStartupBackup: false,
    migrations: CURRENT_MIGRATIONS.slice(0, -1),
  })
  applications.push(previous)
  const receipt = await previous.commands.intakeReceipt(
    { bytes: await image(), name: 'before-eur.png' },
    'drop',
  )
  close(previous)

  const engine = new FakeOcrEngine(async () => ({
    text: 'EURO UPGRADE GmbH\nSUMME EUR 15,25\n15.01.2026',
    confidence: 90,
  }))
  const upgraded = await openProfileApplication({
    profile,
    paths,
    clock,
    createStartupBackup: false,
    ocrEngine: engine,
  })
  applications.push(upgraded)
  await expect(
    waitForReceipt(upgraded, receipt.id, 'read'),
  ).resolves.toMatchObject({
    originalFileName: 'before-eur.jpg',
    ocrCurrency: 'EUR',
    ocrTotalMinor: 1_525,
  })
})
