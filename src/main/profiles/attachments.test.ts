import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, test, vi } from 'vitest'
import type { CreateTransactionInput } from '../../shared/transactions'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry, type ProfilePaths } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup(createStartupBackup = false): Promise<{
  application: ProfileApplication
  paths: ProfilePaths
  profile: ReturnType<ProfileRegistry['createProfile']>
  input: CreateTransactionInput
}> {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-attachments-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Attachment test')
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({
    profile,
    paths,
    clock,
    createStartupBackup,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  return {
    application,
    paths,
    profile,
    input: {
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 100,
      payeeName: null,
      categoryId: null,
      note: '',
    },
  }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('imports supported files by magic bytes, preserves small files, and rejects invalid sources', async () => {
  const { application, paths } = await setup()
  const sources = join(paths.profileDirectory, 'sources')
  mkdirSync(sources)
  const png = await sharp({
    create: { width: 8, height: 6, channels: 3, background: '#c04020' },
  })
    .png()
    .toBuffer()
  const pngPath = join(sources, 'receipt.txt')
  const pdf = Buffer.from('%PDF-1.7\nsynthetic document\n%%EOF\n')
  const pdfPath = join(sources, 'invoice.bin')
  const jpegPath = join(sources, 'photo.pdf')
  const webpPath = join(sources, 'scan.jpg')
  const invalidPath = join(sources, 'invalid.png')
  const largePath = join(sources, 'large.pdf')
  writeFileSync(pngPath, png)
  writeFileSync(pdfPath, pdf)
  await sharp({
    create: { width: 5, height: 7, channels: 3, background: '#804020' },
  })
    .jpeg()
    .toFile(jpegPath)
  await sharp({
    create: { width: 7, height: 5, channels: 3, background: '#204080' },
  })
    .webp()
    .toFile(webpPath)
  writeFileSync(invalidPath, 'not an image')
  writeFileSync(largePath, Buffer.alloc(25 * 1024 * 1024 + 1, 1))

  const stagedPng = await application.commands.importAttachment(pngPath)
  const stagedPdf = await application.commands.importAttachment(pdfPath)
  const stagedJpeg = await application.commands.importAttachment(jpegPath)
  const stagedWebp = await application.commands.importAttachment(webpPath)
  expect(stagedPng).toMatchObject({
    originalFileName: 'receipt.png',
    mediaType: 'image/png',
    byteSize: png.length,
  })
  expect(stagedPdf).toMatchObject({
    originalFileName: 'invoice.pdf',
    mediaType: 'application/pdf',
    byteSize: pdf.length,
  })
  expect(stagedJpeg).toMatchObject({ mediaType: 'image/jpeg' })
  expect(stagedWebp).toMatchObject({ mediaType: 'image/webp' })
  expect(
    readFileSync(
      join(paths.dataDirectory, 'attachments', stagedPng.storedName),
    ),
  ).toEqual(png)
  expect(
    readFileSync(
      join(paths.dataDirectory, 'attachments', stagedPdf.storedName),
    ),
  ).toEqual(pdf)
  expect(
    readFileSync(
      join(paths.dataDirectory, 'attachments', stagedJpeg.storedName),
    ),
  ).toEqual(readFileSync(jpegPath))
  expect(
    readFileSync(
      join(paths.dataDirectory, 'attachments', stagedWebp.storedName),
    ),
  ).toEqual(readFileSync(webpPath))
  await expect(
    application.commands.importAttachment(invalidPath),
  ).rejects.toThrow('attachments.error.type')
  await expect(
    application.commands.importAttachment(largePath),
  ).rejects.toThrow('attachments.error.size')
})

test('forces detected extensions and makes unsafe Windows names harmless', async () => {
  const { application, paths } = await setup()
  const bytes = await sharp({
    create: { width: 4, height: 3, channels: 3, background: '#c04020' },
  })
    .jpeg()
    .toBuffer()

  const names = ['x.hta', 'a.jpg:x', 'CON.png', 'name.']
  const receipts = []
  for (const name of names) {
    receipts.push(
      await application.commands.intakeReceipt({ bytes, name }, 'phone'),
    )
  }

  expect(receipts.map(({ originalFileName }) => originalFileName)).toEqual([
    'x.jpg',
    'a.jpg',
    'attachment.jpg',
    'name.jpg',
  ])
  const temporary = join(paths.profileDirectory, 'open')
  for (const receipt of receipts) {
    const copy = application.commands.copyAttachmentForOpening(
      {
        attachment: {
          originalFileName: receipt.originalFileName,
          storedName: receipt.storedName,
          mediaType: receipt.mediaType,
          byteSize: receipt.byteSize,
        },
      },
      temporary,
    )
    expect(basename(copy)).toMatch(/\.jpg$/)
    expect(basename(copy)).not.toMatch(/[<>:"/\\|?*]/)
  }
})

test('applies EXIF orientation, bounds large images, deduplicates, and never rewrites stored content', async () => {
  const { application, paths } = await setup()
  const source = join(paths.profileDirectory, 'large-photo.any')
  await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: '#2080c0' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toFile(source)
  const first = await application.commands.importAttachment(source)
  const storedPath = join(paths.dataDirectory, 'attachments', first.storedName)
  const metadata = await sharp(storedPath).metadata()
  expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(2000)
  expect(metadata.height).toBeGreaterThan(metadata.width!)
  expect(metadata.orientation).toBeUndefined()
  const firstModified = statSync(storedPath).mtimeMs
  const second = await application.commands.importAttachment(source)
  expect(second.storedName).toBe(first.storedName)
  expect(statSync(storedPath).mtimeMs).toBe(firstModified)
})

test('attach, remove, create-with-attachments, and transaction deletion restore exact rows with undo', async () => {
  const { application, paths, input } = await setup()
  const source = join(paths.profileDirectory, 'receipt.pdf')
  writeFileSync(source, '%PDF-1.7\nreceipt\n%%EOF\n')
  const staged = await application.commands.importAttachment(source)
  const transaction = application.commands.createTransaction(input)

  expect(() =>
    application.commands.createTransaction({
      ...input,
      stagedAttachments: [{ ...staged, byteSize: staged.byteSize + 1 }],
    }),
  ).toThrow('attachments.error.staged')
  expect(application.queries.listTransactions().totalCount).toBe(1)

  const attached = application.commands.attachAttachment(transaction.id, staged)
  expect(application.queries.listAttachments(transaction.id)).toEqual([
    attached,
  ])
  application.commands.removeAttachment(attached.id)
  expect(application.queries.listAttachments(transaction.id)).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAttachments(transaction.id)).toEqual([
    attached,
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAttachments(transaction.id)).toEqual([])
  const reattached = application.commands.attachAttachment(
    transaction.id,
    staged,
  )

  const created = application.commands.createTransaction({
    ...input,
    stagedAttachments: [staged, { ...staged, originalFileName: 'copy.pdf' }],
  })
  expect(
    created.attachments.map(({ originalFileName }) => originalFileName),
  ).toEqual(['receipt.pdf', 'copy.pdf'])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([
    { ...transaction, attachments: [reattached] },
  ])

  application.commands.deleteTransaction({ id: transaction.id })
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAttachments(transaction.id)).toEqual([
    reattached,
  ])
})

test('deleting a transaction can save de-duplicated attachment copies before undo restores it', async () => {
  const { application, paths, input } = await setup()
  const firstPath = join(paths.profileDirectory, 'receipt.pdf')
  const secondPath = join(paths.profileDirectory, 'other.pdf')
  writeFileSync(firstPath, '%PDF-1.7\nfirst\n%%EOF\n')
  writeFileSync(secondPath, '%PDF-1.7\nsecond\n%%EOF\n')
  const first = await application.commands.importAttachment(firstPath)
  const second = await application.commands.importAttachment(secondPath)
  const transaction = application.commands.createTransaction({
    ...input,
    stagedAttachments: [first, { ...second, originalFileName: 'receipt.pdf' }],
  })
  const copies = join(paths.profileDirectory, 'copies')
  application.commands.deleteTransaction({
    id: transaction.id,
    saveAttachmentsTo: copies,
  })
  expect(readFileSync(join(copies, 'receipt.pdf'), 'utf8')).toContain('first')
  expect(readFileSync(join(copies, 'receipt (2).pdf'), 'utf8')).toContain(
    'second',
  )
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAttachments(transaction.id)).toEqual(
    transaction.attachments,
  )
})

test('profile open sweeps only unreferenced content files', async () => {
  const context = await setup()
  const source = join(context.paths.profileDirectory, 'receipt.pdf')
  writeFileSync(source, '%PDF-1.7\nkeep\n%%EOF\n')
  const staged = await context.application.commands.importAttachment(source)
  context.application.commands.createTransaction({
    ...context.input,
    stagedAttachments: [staged],
  })
  const orphan = join(
    context.paths.dataDirectory,
    'attachments',
    `${'f'.repeat(64)}.pdf`,
  )
  writeFileSync(orphan, '%PDF-1.7\norphan\n%%EOF\n')
  context.application.close()
  applications.splice(applications.indexOf(context.application), 1)

  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    createStartupBackup: false,
  })
  applications.push(reopened)
  expect(() => statSync(orphan)).toThrow()
  expect(
    readFileSync(
      join(context.paths.dataDirectory, 'attachments', staged.storedName),
      'utf8',
    ),
  ).toContain('keep')
})

test('startup backups incrementally pool content and restore missing referenced files', async () => {
  const context = await setup()
  const source = join(context.paths.profileDirectory, 'receipt.pdf')
  writeFileSync(source, '%PDF-1.7\nbacked up\n%%EOF\n')
  const staged = await context.application.commands.importAttachment(source)
  const transaction = context.application.commands.createTransaction({
    ...context.input,
    stagedAttachments: [staged],
  })
  context.application.close()
  applications.splice(applications.indexOf(context.application), 1)

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
    staged.storedName,
  )
  expect(readFileSync(pooled, 'utf8')).toContain('backed up')
  const pooledModified = statSync(pooled).mtimeMs
  const secondSource = join(context.paths.profileDirectory, 'second.pdf')
  writeFileSync(secondSource, '%PDF-1.7\nnew content\n%%EOF\n')
  const second = await backedUp.commands.importAttachment(secondSource)
  backedUp.commands.attachAttachment(transaction.id, second)

  backedUp.close()
  applications.splice(applications.indexOf(backedUp), 1)
  const nextBackup = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
  })
  applications.push(nextBackup)
  expect(statSync(pooled).mtimeMs).toBe(pooledModified)
  expect(
    readFileSync(
      join(context.paths.backupDirectory, 'attachments', second.storedName),
      'utf8',
    ),
  ).toContain('new content')

  const live = join(
    context.paths.dataDirectory,
    'attachments',
    staged.storedName,
  )
  rmSync(live)
  expect(existsSync(live)).toBe(false)
  await nextBackup.commands.restoreBackup({
    backupId: backup.id,
    confirmed: true,
  })
  expect(readFileSync(live, 'utf8')).toContain('backed up')
  expect(nextBackup.queries.listAttachments(transaction.id)).toEqual(
    transaction.attachments,
  )
})

test('a missing referenced attachment does not prevent startup backup or profile open', async () => {
  const context = await setup()
  const source = join(context.paths.profileDirectory, 'receipt.pdf')
  writeFileSync(source, '%PDF-1.7\nmissing source\n%%EOF\n')
  const staged = await context.application.commands.importAttachment(source)
  context.application.commands.createTransaction({
    ...context.input,
    stagedAttachments: [staged],
  })
  context.application.close()
  applications.splice(applications.indexOf(context.application), 1)
  rmSync(join(context.paths.dataDirectory, 'attachments', staged.storedName))

  const logger = { error: vi.fn() }
  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    logger,
  })
  applications.push(reopened)

  expect(reopened.queries.listBackups()).toHaveLength(1)
  expect(logger.error).toHaveBeenCalled()
})

test('a corrupt backup-pool file is repaired by backup and never restored', async () => {
  const context = await setup()
  const source = join(context.paths.profileDirectory, 'receipt.pdf')
  writeFileSync(source, '%PDF-1.7\nverified pool bytes\n%%EOF\n')
  const staged = await context.application.commands.importAttachment(source)
  context.application.commands.createTransaction({
    ...context.input,
    stagedAttachments: [staged],
  })
  context.application.close()
  applications.splice(applications.indexOf(context.application), 1)

  const backedUp = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
  })
  applications.push(backedUp)
  const backup = backedUp.queries.listBackups()[0]
  const pool = join(
    context.paths.backupDirectory,
    'attachments',
    staged.storedName,
  )
  writeFileSync(pool, 'truncated')
  backedUp.close()
  applications.splice(applications.indexOf(backedUp), 1)

  const logger = { error: vi.fn() }
  const repaired = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock,
    logger,
  })
  applications.push(repaired)
  expect(readFileSync(pool, 'utf8')).toContain('verified pool bytes')
  logger.error.mockClear()

  writeFileSync(pool, 'corrupt again')
  const live = join(
    context.paths.dataDirectory,
    'attachments',
    staged.storedName,
  )
  rmSync(live)
  await repaired.commands.restoreBackup({
    backupId: backup.id,
    confirmed: true,
  })
  expect(existsSync(live)).toBe(false)
  expect(logger.error).toHaveBeenCalled()
})
