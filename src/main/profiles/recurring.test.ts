import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import type { RecurringSchedule } from '../../shared/recurring'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []

async function setup(initial = '2026-01-15T10:00:00.000Z') {
  let now = new Date(initial)
  const clock = () => now
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-recurring-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Recurring test')
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({ profile, paths, clock })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  const category = application.commands.createCategory({
    name: 'Recurring category',
    kind: 'expense',
    parentId: null,
  })
  application.commands.createTemplate({ name: 'Tags', tagNames: ['Bills'] })
  const tag = application.queries.listTags()[0]
  const input = {
    kind: 'expense' as const,
    accountId: account.id,
    amountMinor: 12_345,
    payeeName: 'Power company',
    categoryId: category.id,
    tagIds: [tag.id],
    note: 'Estimated amount',
    startDate: '2025-01-01',
    endDate: null,
  }
  return {
    application,
    profile,
    paths,
    clock,
    setNow(value: string) {
      now = new Date(value)
    },
    account,
    category,
    tag,
    input,
  }
}

afterEach(() => {
  for (const application of applications.splice(0)) {
    try {
      application.close()
    } catch {
      // A test may already have closed it to verify reopening.
    }
  }
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test.each([
  [{ type: 'monthly', day: 15, intervalMonths: 1 }, '2026-02-15'],
  [{ type: 'monthly', day: 15, intervalMonths: 2 }, '2026-03-15'],
  [{ type: 'weekly', weekday: 4, intervalWeeks: 2 }, '2026-01-29'],
  [{ type: 'yearly', month: 1, day: 15 }, '2027-01-15'],
] as const)(
  'generates each schedule through the profile API and catches up exactly once after a clock jump: %j',
  async (schedule, nextDate) => {
    const context = await setup()
    const recurring = context.application.commands.createRecurringTransaction({
      ...context.input,
      schedule: schedule as RecurringSchedule,
    })
    context.application.commands.generateRecurringTransactions()
    expect(context.application.queries.listPendingTransactions()).toEqual([
      expect.objectContaining({
        recurringId: recurring.id,
        dueDate: '2026-01-15',
        amountMinor: 12_345,
      }),
    ])
    context.setNow(`${nextDate}T12:00:00.000Z`)
    context.application.commands.generateRecurringTransactions()
    context.application.commands.generateRecurringTransactions()
    expect(
      context.application.queries
        .listPendingTransactions()
        .map((pending) => pending.dueDate),
    ).toEqual(['2026-01-15', nextDate])
  },
)

test('new definitions skip occurrences before creation and reopen catches up idempotently without clearing undo', async () => {
  const context = await setup()
  const recurring = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 1, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  expect(context.application.queries.listPendingTransactions()).toEqual([])
  context.setNow('2026-03-01T10:00:00.000Z')
  context.application.close()
  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock: context.clock,
  })
  applications.push(reopened)
  expect(reopened.queries.listPendingTransactions()).toEqual([
    expect.objectContaining({
      recurringId: recurring.id,
      dueDate: '2026-02-01',
    }),
    expect.objectContaining({
      recurringId: recurring.id,
      dueDate: '2026-03-01',
    }),
  ])
  reopened.commands.generateRecurringTransactions()
  expect(reopened.queries.listPendingTransactions()).toHaveLength(2)
  reopened.close()
  const restarted = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock: context.clock,
  })
  applications.push(restarted)
  expect(restarted.queries.listPendingTransactions()).toHaveLength(2)
  const later = restarted.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'yearly', month: 3, day: 1 },
  })
  restarted.commands.generateRecurringTransactions()
  expect(restarted.commands.undoLast()).toBe(true)
  expect(
    restarted.queries
      .listRecurringTransactions()
      .some((item) => item.id === later.id),
  ).toBe(false)
})

test('a due occurrence is generated immediately after create without replacing its undo entry', async () => {
  const context = await setup()
  const recurring = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })

  expect(context.application.queries.listPendingTransactions()).toEqual([
    expect.objectContaining({
      recurringId: recurring.id,
      dueDate: '2026-01-15',
    }),
  ])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listRecurringTransactions()).toEqual([])
  expect(context.application.queries.listPendingTransactions()).toEqual([])
})

test('pause generates occurrences due since the last tick and resume generates its next due occurrence immediately', async () => {
  const context = await setup()
  const recurring = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
  })

  context.setNow('2026-01-22T10:00:00.000Z')
  context.application.commands.pauseRecurringTransaction(recurring.id)
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15', '2026-01-22'])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries.listRecurringTransactions()[0],
  ).toMatchObject({
    paused: false,
    generatedThrough: '2026-01-15',
  })
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15'])

  context.application.commands.generateRecurringTransactions()
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15', '2026-01-22'])
  context.application.commands.pauseRecurringTransaction(recurring.id)

  context.setNow('2026-01-29T10:00:00.000Z')
  context.application.commands.resumeRecurringTransaction(recurring.id)
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15', '2026-01-22', '2026-01-29'])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries.listRecurringTransactions()[0],
  ).toMatchObject({
    paused: true,
    generatedThrough: '2026-01-22',
  })
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15', '2026-01-22'])
})

test('pause, resume and end date control generation; every recurring command is undoable', async () => {
  const context = await setup()
  const recurring = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
    endDate: '2026-02-05',
  })
  context.application.commands.generateRecurringTransactions()
  context.application.commands.pauseRecurringTransaction(recurring.id)
  expect(
    context.application.queries.listRecurringTransactions()[0].paused,
  ).toBe(true)
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries.listRecurringTransactions()[0].paused,
  ).toBe(false)
  context.application.commands.pauseRecurringTransaction(recurring.id)
  context.setNow('2026-01-29T10:00:00.000Z')
  context.application.commands.generateRecurringTransactions()
  expect(context.application.queries.listPendingTransactions()).toHaveLength(1)
  context.application.commands.resumeRecurringTransaction(recurring.id)
  expect(
    context.application.queries.listRecurringTransactions()[0],
  ).toMatchObject({
    paused: false,
    generatedThrough: '2026-01-29',
  })
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((item) => item.dueDate),
  ).toEqual(['2026-01-15', '2026-01-29'])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries.listRecurringTransactions()[0].paused,
  ).toBe(true)
  context.application.commands.resumeRecurringTransaction(recurring.id)
  context.setNow('2026-02-20T10:00:00.000Z')
  context.application.commands.generateRecurringTransactions()
  expect(
    context.application.queries
      .listPendingTransactions()
      .map((item) => item.dueDate),
  ).toEqual(['2026-01-15', '2026-01-29', '2026-02-05'])
})

test('editing changes only not-yet-generated snapshots and delete undo restores pending occurrences', async () => {
  const context = await setup()
  const recurring = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  const originalPending =
    context.application.queries.listPendingTransactions()[0]
  const beforeEdit = context.application.queries.listRecurringTransactions()[0]
  context.setNow('2026-01-22T10:00:00.000Z')
  const edited = context.application.commands.updateRecurringTransaction({
    ...context.input,
    id: recurring.id,
    amountMinor: 54_321,
    payeeName: 'Updated company',
    tagIds: [],
    note: 'Updated estimate',
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
  })
  expect(context.application.queries.listPendingTransactions()).toEqual([
    originalPending,
    expect.objectContaining({
      recurringId: edited.id,
      dueDate: '2026-01-22',
      amountMinor: 54_321,
      payeeName: 'Updated company',
      tagIds: [],
    }),
  ])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listRecurringTransactions()[0]).toEqual(
    beforeEdit,
  )
  expect(context.application.queries.listPendingTransactions()).toEqual([
    originalPending,
  ])
  context.application.commands.deleteRecurringTransaction(recurring.id)
  expect(context.application.queries.listRecurringTransactions()).toEqual([])
  expect(context.application.queries.listPendingTransactions()).toEqual([])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listRecurringTransactions()).toEqual([
    beforeEdit,
  ])
  expect(context.application.queries.listPendingTransactions()).toEqual([
    originalPending,
  ])
})

test('a recurring command generates only its definition and later background occurrences survive undo', async () => {
  const context = await setup()
  const first = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
  })
  const second = context.application.commands.createRecurringTransaction({
    ...context.input,
    payeeName: 'Second company',
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
  })

  context.setNow('2026-01-22T10:00:00.000Z')
  context.application.commands.updateRecurringTransaction({
    ...context.input,
    id: first.id,
    amountMinor: 54_321,
    schedule: { type: 'weekly', weekday: 4, intervalWeeks: 1 },
  })
  const commandPending = context.application.queries.listPendingTransactions()
  expect(
    commandPending
      .filter((pending) => pending.recurringId === first.id)
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15', '2026-01-22'])
  expect(
    commandPending
      .filter((pending) => pending.recurringId === second.id)
      .map((pending) => pending.dueDate),
  ).toEqual(['2026-01-15'])

  context.setNow('2026-01-29T10:00:00.000Z')
  context.application.commands.generateRecurringTransactions()
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries
      .listRecurringTransactions()
      .find((recurring) => recurring.id === first.id)?.amountMinor,
  ).toBe(12_345)
  expect(
    context.application.queries
      .listPendingTransactions()
      .filter((pending) => pending.recurringId === first.id)
      .map((pending) => [pending.dueDate, pending.amountMinor]),
  ).toEqual([
    ['2026-01-15', 12_345],
    ['2026-01-29', 54_321],
  ])
})

test('pending snapshots do not affect balances, transaction list totals, or expense reports', async () => {
  const context = await setup()
  context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  expect(context.application.queries.listPendingTransactions()).toHaveLength(1)
  expect(
    context.application.queries.getAccountBalance(context.account.id),
  ).toBe(0)
  expect(context.application.queries.listTransactions()).toMatchObject({
    totalCount: 0,
    totals: [],
  })
  expect(
    context.application.queries.getCategoryBreakdown({ period: 'thisMonth' }),
  ).toMatchObject({ total: { roundedMinor: 0 }, categories: [] })
})

test('confirm creates the exact snapshotted transaction and undo restores the pending occurrence', async () => {
  const context = await setup()
  context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  const pending = context.application.queries.listPendingTransactions()[0]

  const confirmed = context.application.commands.confirmPendingTransaction({
    id: pending.id,
  })

  expect(confirmed).toMatchObject({
    accountId: context.account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 12_345,
    payeeName: 'Power company',
    note: 'Estimated amount',
    excluded: false,
    lines: [
      {
        amountMinor: 12_345,
        categoryId: context.category.id,
        note: 'Estimated amount',
        tags: [context.tag],
      },
    ],
  })
  expect(context.application.queries.listPendingTransactions()).toEqual([])
  expect(
    context.application.queries.getAccountBalance(context.account.id),
  ).toBe(-12_345)
  expect(
    context.application.queries.getCategoryBreakdown({ period: 'thisMonth' }),
  ).toMatchObject({ total: { roundedMinor: 12_345 } })

  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listTransactions().totalCount).toBe(0)
  expect(context.application.queries.listPendingTransactions()).toEqual([
    pending,
  ])
  expect(
    context.application.queries.getAccountBalance(context.account.id),
  ).toBe(0)
})

test('confirm accepts a changed amount and past date, rejects future and duplicate confirmation, and resolves payee aliases', async () => {
  const context = await setup()
  const aliasSource = context.application.commands.createTransaction({
    accountId: context.account.id,
    kind: 'income',
    date: '2026-01-01',
    totalMinor: 1,
    payeeName: 'Canonical company',
    categoryId: null,
    note: '',
  })
  context.application.commands.addPayeeAlias({
    payeeId: aliasSource.payeeId!,
    name: 'Power company',
  })
  context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  const pending = context.application.queries.listPendingTransactions()[0]

  expect(() =>
    context.application.commands.confirmPendingTransaction({
      id: pending.id,
      amountMinor: 54_321,
      date: '2026-01-16',
    }),
  ).toThrow('transactions.error.futureDate')
  expect(context.application.queries.listPendingTransactions()).toEqual([
    pending,
  ])

  const confirmed = context.application.commands.confirmPendingTransaction({
    id: pending.id,
    amountMinor: 54_321,
    date: '2026-01-14',
  })
  expect(confirmed).toMatchObject({
    date: '2026-01-14',
    totalMinor: 54_321,
    payeeId: aliasSource.payeeId,
    payeeName: 'Canonical company',
  })
  expect(() =>
    context.application.commands.confirmPendingTransaction({ id: pending.id }),
  ).toThrow('pending.error.notPending')
})

test('skip and undo update the due counter, and consumed occurrences never regenerate across reopen', async () => {
  const context = await setup()
  context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  const pending = context.application.queries.listPendingTransactions()[0]
  expect(context.application.queries.getDuePendingTransactionCount()).toBe(1)

  context.application.commands.skipPendingTransaction(pending.id)
  expect(context.application.queries.listPendingTransactions()).toEqual([])
  expect(context.application.queries.getDuePendingTransactionCount()).toBe(0)
  expect(context.application.commands.undoLast()).toBe(true)
  expect(context.application.queries.listPendingTransactions()).toEqual([
    pending,
  ])
  expect(context.application.queries.getDuePendingTransactionCount()).toBe(1)

  context.application.commands.skipPendingTransaction(pending.id)
  context.application.close()
  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock: context.clock,
  })
  applications.push(reopened)
  reopened.commands.generateRecurringTransactions()
  expect(reopened.queries.listPendingTransactions()).toEqual([])
  expect(reopened.queries.getDuePendingTransactionCount()).toBe(0)
})

test('confirm rejects an archived snapshot account without consuming the occurrence', async () => {
  const context = await setup()
  context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  const pending = context.application.queries.listPendingTransactions()[0]
  context.application.commands.archiveAccount(context.account.id)
  expect(() =>
    context.application.commands.confirmPendingTransaction({ id: pending.id }),
  ).toThrow('pending.error.accountArchived')
  expect(context.application.queries.listPendingTransactions()).toEqual([
    pending,
  ])
})

test('invalid pending ids report the pending not-found error', async () => {
  const context = await setup()

  expect(() =>
    context.application.commands.confirmPendingTransaction({ id: 'invalid' }),
  ).toThrow('pending.error.notFound')
  expect(() =>
    context.application.commands.skipPendingTransaction('invalid'),
  ).toThrow('pending.error.notFound')
})

test('confirmed occurrences never regenerate across reopen', async () => {
  const context = await setup()
  context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  const pending = context.application.queries.listPendingTransactions()[0]
  const confirmed = context.application.commands.confirmPendingTransaction({
    id: pending.id,
  })
  context.application.close()

  const reopened = await openProfileApplication({
    profile: context.profile,
    paths: context.paths,
    clock: context.clock,
  })
  applications.push(reopened)
  reopened.commands.generateRecurringTransactions()
  expect(reopened.queries.listPendingTransactions()).toEqual([])
  expect(reopened.queries.listTransactions().rows).toEqual([
    expect.objectContaining({ id: confirmed.id }),
  ])
})

test.each(['confirm', 'skip'] as const)(
  '%s then delete and both undos restore the occurrence to pending',
  async (decision) => {
    const context = await setup()
    const recurring = context.application.commands.createRecurringTransaction({
      ...context.input,
      schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
    })
    const pending = context.application.queries.listPendingTransactions()[0]
    const confirmed =
      decision === 'confirm'
        ? context.application.commands.confirmPendingTransaction({
            id: pending.id,
          })
        : null

    if (decision === 'skip')
      context.application.commands.skipPendingTransaction(pending.id)
    context.application.commands.deleteRecurringTransaction(recurring.id)
    expect(context.application.commands.undoLast()).toBe(true)
    expect(context.application.queries.listPendingTransactions()).toEqual([])

    expect(context.application.commands.undoLast()).toBe(true)
    expect(context.application.queries.listPendingTransactions()).toEqual([
      pending,
    ])
    if (confirmed)
      expect(
        context.application.queries
          .listTransactions()
          .rows.some((transaction) => transaction.id === confirmed.id),
      ).toBe(false)
  },
)

test('account deletion is guarded while category and tag deletion null/remove references with undo', async () => {
  const context = await setup()
  const recurring = context.application.commands.createRecurringTransaction({
    ...context.input,
    schedule: { type: 'monthly', day: 15, intervalMonths: 1 },
  })
  context.application.commands.generateRecurringTransactions()
  expect(() =>
    context.application.commands.deleteAccount(context.account.id),
  ).toThrow('accounts.error.notEmpty')
  context.application.commands.deleteCategory({ id: context.category.id })
  expect(
    context.application.queries.listRecurringTransactions()[0].categoryId,
  ).toBeNull()
  expect(
    context.application.queries.listPendingTransactions()[0].categoryId,
  ).toBeNull()
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries.listRecurringTransactions()[0].categoryId,
  ).toBe(recurring.categoryId)
  expect(
    context.application.queries.listPendingTransactions()[0].categoryId,
  ).toBe(recurring.categoryId)
  context.application.commands.deleteTag(context.tag.id)
  expect(
    context.application.queries.listRecurringTransactions()[0].tagIds,
  ).toEqual([])
  expect(
    context.application.queries.listPendingTransactions()[0].tagIds,
  ).toEqual([])
  expect(context.application.commands.undoLast()).toBe(true)
  expect(
    context.application.queries.listRecurringTransactions()[0].tagIds,
  ).toEqual([context.tag.id])
  expect(
    context.application.queries.listPendingTransactions()[0].tagIds,
  ).toEqual([context.tag.id])
})
