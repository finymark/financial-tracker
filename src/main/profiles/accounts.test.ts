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
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-accounts-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Test profile')
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({ profile, paths, clock })
  applications.push(application)
  return { application, profile, paths, registry }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('creates UUID accounts and persists exact opening balances in each currency', async () => {
  const { application, profile, paths } = await setup()
  const huf = application.commands.createAccount({
    name: '  Cash  ',
    currency: 'HUF',
    openingBalance: 1234567,
    openingDate: '2026-01-01',
  })
  const chf = application.commands.createAccount({
    name: 'Bank',
    currency: 'CHF',
    openingBalance: -901,
    openingDate: '2025-12-31',
  })
  expect(huf.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  expect(chf.id).not.toBe(huf.id)
  expect(huf).toMatchObject({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 1234567,
    openingDate: '2026-01-01',
    archived: false,
    balance: 1234567,
    createdAt: '2026-01-15T10:00:00.000Z',
    hasTransactions: false,
  })
  application.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listAccounts()).toEqual([huf, chf])
  expect(reopened.queries.getAccountBalance(chf.id)).toBe(-901)
  expect(reopened.queries.hasAccountTransactions(huf.id)).toBe(false)
})

test('rejects invalid account input without creating any accounts', async () => {
  const { application } = await setup()
  const valid = {
    name: 'Cash',
    currency: 'HUF' as const,
    openingBalance: 0,
    openingDate: '2026-01-01',
  }
  for (const invalid of [
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(101) },
    { name: 42 },
    { currency: 'EUR' },
    { openingBalance: 1.5 },
    { openingBalance: NaN },
    { openingBalance: Infinity },
    { openingBalance: Number.MAX_SAFE_INTEGER + 1 },
    { openingBalance: '100' },
    { openingDate: '2026-02-30' },
    { openingDate: '2025-02-29' },
    { openingDate: '2026-1-01' },
    { openingDate: '' },
  ]) {
    expect(() =>
      application.commands.createAccount({
        ...valid,
        ...invalid,
      } as typeof valid),
    ).toThrow()
    expect(application.queries.listAccounts()).toEqual([])
  }
  const leapDay = application.commands.createAccount({
    ...valid,
    openingDate: '2024-02-29',
    openingBalance: Number.MAX_SAFE_INTEGER,
  })
  expect(application.queries.getAccountBalance(leapDay.id)).toBe(
    9007199254740991,
  )
})

test('renames an empty account and changes its currency without changing its amount or date', async () => {
  const { application } = await setup()
  const account = application.commands.createAccount({
    name: 'Old',
    currency: 'HUF',
    openingBalance: 123,
    openingDate: '2026-01-01',
  })
  const renamed = application.commands.renameAccount({
    id: account.id,
    name: '  New  ',
  })
  expect(renamed).toEqual({ ...account, name: 'New' })
  expect(() =>
    application.commands.renameAccount({ id: account.id, name: ' ' }),
  ).toThrow('accounts.error.name')
  const changed = application.commands.changeAccountCurrency({
    id: account.id,
    currency: 'CHF',
  })
  expect(changed).toEqual({ ...renamed, currency: 'CHF' })
  expect(application.queries.listAccounts()).toEqual([changed])
})

test('archiving preserves the account and balance but hides it from account pickers', async () => {
  const { application, profile, paths } = await setup()
  const archived = application.commands.createAccount({
    name: 'Closed bank',
    currency: 'CHF',
    openingBalance: 5099,
    openingDate: '2025-01-01',
  })
  const active = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  application.commands.archiveAccount(archived.id)
  application.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listAccounts()).toEqual([
    { ...archived, archived: true },
    active,
  ])
  expect(reopened.queries.listAccountOptions()).toEqual([
    {
      id: active.id,
      name: active.name,
      currency: active.currency,
      archived: false,
    },
  ])
  expect(reopened.queries.getAccountBalance(archived.id)).toBe(5099)
})

test('deletes active or archived accounts without transactions even with an opening balance', async () => {
  const { application } = await setup()
  for (const archive of [false, true]) {
    const account = application.commands.createAccount({
      name: 'Empty',
      currency: 'CHF',
      openingBalance: 10000,
      openingDate: '2026-01-01',
    })
    if (archive) application.commands.archiveAccount(account.id)
    application.commands.deleteAccount(account.id)
    expect(application.queries.listAccounts()).toEqual([])
    expect(() => application.queries.getAccountBalance(account.id)).toThrow(
      'accounts.error.notFound',
    )
    expect(() => application.commands.deleteAccount(account.id)).toThrow(
      'accounts.error.notFound',
    )
  }
})

test('accounts and their mutation commands stay isolated between profiles', async () => {
  const { application, registry } = await setup()
  const account = application.commands.createAccount({
    name: 'First account',
    currency: 'HUF',
    openingBalance: 301,
    openingDate: '2026-01-01',
  })
  const second = registry.createProfile('Second')
  const other = await openProfileApplication({
    profile: second,
    paths: registry.getProfilePaths(second.id),
    clock,
  })
  applications.push(other)
  expect(other.queries.listAccounts()).toEqual([])
  expect(() =>
    other.commands.renameAccount({ id: account.id, name: 'Changed' }),
  ).toThrow('accounts.error.notFound')
  expect(() =>
    other.commands.changeAccountCurrency({ id: account.id, currency: 'CHF' }),
  ).toThrow('accounts.error.notFound')
  expect(() => other.commands.archiveAccount(account.id)).toThrow(
    'accounts.error.notFound',
  )
  expect(() => other.commands.deleteAccount(account.id)).toThrow(
    'accounts.error.notFound',
  )
  expect(() => other.queries.getAccountBalance(account.id)).toThrow(
    'accounts.error.notFound',
  )
  expect(() => other.queries.hasAccountTransactions(account.id)).toThrow(
    'accounts.error.notFound',
  )
  expect(application.queries.listAccounts()).toEqual([account])
})

test('create, edit, archive, unarchive, and delete account commands undo exact prior images', async () => {
  const { application } = await setup()
  const created = application.commands.createAccount({
    name: 'Undo account',
    currency: 'HUF',
    openingBalance: 123,
    openingDate: '2026-01-01',
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([])

  const account = application.commands.createAccount({
    name: 'Original',
    currency: 'HUF',
    openingBalance: 123,
    openingDate: '2026-01-01',
  })
  application.commands.renameAccount({ id: account.id, name: 'Renamed' })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([account])

  application.commands.changeAccountCurrency({
    id: account.id,
    currency: 'CHF',
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([account])

  application.commands.archiveAccount(account.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([account])

  application.commands.archiveAccount(account.id)
  application.commands.unarchiveAccount(account.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([
    { ...account, archived: true },
  ])

  application.commands.deleteAccount(account.id)
  expect(application.queries.listAccounts()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([
    { ...account, archived: true },
  ])
  expect(created.id).not.toBe(account.id)
})
