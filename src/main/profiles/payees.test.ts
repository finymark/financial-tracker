import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
let now = new Date('2026-01-15T10:00:00.000Z')

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-payees-'))
  directories.push(directory)
  const clock = () => now
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Payee test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const create = (payeeName: string, date: string) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date,
      totalMinor: 100,
      payeeName,
      categoryId: null,
      note: '',
    })
  return { application, create }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
  now = new Date('2026-01-15T10:00:00.000Z')
})

test('suggests matching payees by frequency then recency and resolves folded aliases', async () => {
  const { application, create } = await setup()
  const olderFrequent = create('Older frequent', '2026-01-10')
  create('Older frequent', '2026-01-11')
  const newerFrequent = create('Café Central', '2026-01-13')
  create('Café Central', '2026-01-14')
  const recent = create('Recent once', '2026-01-15')

  application.commands.addPayeeAlias({
    payeeId: newerFrequent.payeeId!,
    name: 'KÁVÉZÓ 0123',
  })

  expect(
    application.queries
      .suggestPayees({ query: '', limit: 10 })
      .map(({ id, usageCount, lastUsedDate }) => ({
        id,
        usageCount,
        lastUsedDate,
      })),
  ).toEqual([
    {
      id: newerFrequent.payeeId,
      usageCount: 2,
      lastUsedDate: '2026-01-14',
    },
    {
      id: olderFrequent.payeeId,
      usageCount: 2,
      lastUsedDate: '2026-01-11',
    },
    { id: recent.payeeId, usageCount: 1, lastUsedDate: '2026-01-15' },
  ])
  expect(application.queries.suggestPayees({ query: 'kavezo' })).toMatchObject([
    { id: newerFrequent.payeeId, name: 'Café Central' },
  ])

  const aliasTransaction = create('kávéző 0123', '2026-01-15')
  expect(aliasTransaction).toMatchObject({
    payeeId: newerFrequent.payeeId,
    payeeName: 'Café Central',
  })
  expect(application.queries.listPayees()).toHaveLength(3)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listPayees()).toHaveLength(3)
  expect(application.queries.listPayeeAliases(newerFrequent.payeeId!)).toEqual([
    expect.objectContaining({ name: 'KÁVÉZÓ 0123' }),
  ])
})

test('adds and removes aliases with each command undoable as one unit', async () => {
  const { application, create } = await setup()
  const transaction = create('Railway', '2026-01-15')
  const alias = application.commands.addPayeeAlias({
    payeeId: transaction.payeeId!,
    name: 'MÁV START',
  })
  expect(application.queries.listPayeeAliases(transaction.payeeId!)).toEqual([
    alias,
  ])

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listPayeeAliases(transaction.payeeId!)).toEqual([])

  const restoredAlias = application.commands.addPayeeAlias({
    payeeId: transaction.payeeId!,
    name: 'MÁV START',
  })
  application.commands.removePayeeAlias(restoredAlias.id)
  expect(application.queries.listPayeeAliases(transaction.payeeId!)).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listPayeeAliases(transaction.payeeId!)).toEqual([
    restoredAlias,
  ])
})

test('keeps an aliased payee when undoing its only current transaction', async () => {
  const { application, create } = await setup()
  const original = create('Transit company', '2026-01-14')
  const alias = application.commands.addPayeeAlias({
    payeeId: original.payeeId!,
    name: 'TRANSIT 9876',
  })
  application.commands.deleteTransaction(original.id)
  create('transit 9876', '2026-01-15')

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listPayees()).toEqual([
    expect.objectContaining({ id: original.payeeId, name: 'Transit company' }),
  ])
  expect(application.queries.listPayeeAliases(original.payeeId!)).toEqual([
    alias,
  ])
})

test('requires alias keys to be unique regardless of case and diacritics', async () => {
  const { application, create } = await setup()
  const first = create('First payee', '2026-01-15')
  const second = create('Second payee', '2026-01-15')
  application.commands.addPayeeAlias({
    payeeId: first.payeeId!,
    name: 'Árvíztűrő',
  })

  expect(() =>
    application.commands.addPayeeAlias({
      payeeId: second.payeeId!,
      name: 'ARVIZTURO',
    }),
  ).toThrow('payees.error.aliasConflict')
  expect(application.queries.listPayeeAliases(second.payeeId!)).toEqual([])
})

test('merges transactions and aliases into the survivor and undoes the merge exactly', async () => {
  const { application, create } = await setup()
  const survivorTransaction = create('Lidl', '2026-01-15')
  const sourceTransaction = create('LIDL Magyarország', '2026-01-14')
  create('LIDL Magyarország', '2026-01-13')
  const survivorAlias = application.commands.addPayeeAlias({
    payeeId: survivorTransaction.payeeId!,
    name: 'Lidl 0001',
  })
  const sourceAlias = application.commands.addPayeeAlias({
    payeeId: sourceTransaction.payeeId!,
    name: 'Lidl 0123 Budapest',
  })
  const beforePayees = application.queries.listPayees()
  const beforeRows = application.queries.listTransactions().rows

  const survivor = application.commands.mergePayees({
    sourcePayeeId: sourceTransaction.payeeId!,
    survivorPayeeId: survivorTransaction.payeeId!,
  })

  expect(survivor.id).toBe(survivorTransaction.payeeId)
  expect(application.queries.listPayees()).toEqual([survivor])
  expect(
    application.queries
      .listTransactions()
      .rows.map((transaction) =>
        'payeeId' in transaction ? transaction.payeeId : null,
      ),
  ).toEqual([
    survivorTransaction.payeeId,
    survivorTransaction.payeeId,
    survivorTransaction.payeeId,
  ])
  expect(
    application.queries.listPayeeAliases(survivor.id).map(({ name }) => name),
  ).toEqual(['Lidl 0001', 'Lidl 0123 Budapest', 'LIDL Magyarország'])
  expect(create('lidl magyarorszag', '2026-01-15').payeeId).toBe(survivor.id)
  expect(application.queries.listPayees()).toHaveLength(1)

  expect(application.commands.undoLast()).toBe(true)
  // The latest command was transaction creation through the merged alias.
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listPayees()).toEqual(beforePayees)
  expect(application.queries.listTransactions().rows).toEqual(beforeRows)
  expect(
    application.queries.listPayeeAliases(survivorTransaction.payeeId!),
  ).toEqual([survivorAlias])
  expect(
    application.queries.listPayeeAliases(sourceTransaction.payeeId!),
  ).toEqual([sourceAlias])
})

test('keeps a diacritic-only merged name resolving to the survivor', async () => {
  const { application, create } = await setup()
  const survivor = create('Cafe', '2026-01-15')
  const source = create('Café', '2026-01-14')

  application.commands.mergePayees({
    sourcePayeeId: source.payeeId!,
    survivorPayeeId: survivor.payeeId!,
  })

  expect(create('CAFÉ', '2026-01-15').payeeId).toBe(survivor.payeeId)
  expect(application.queries.listPayees()).toHaveLength(1)
})
