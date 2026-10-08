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
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry, type ProfilePaths } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
let now = new Date('2026-01-15T10:00:00.000Z')
const clock = () => now

async function setup(createStartupBackup = false): Promise<{
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
  })
  applications.push(application)
  return { application, paths, profile }
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
    originalFileName: 'first-photo.bin',
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
