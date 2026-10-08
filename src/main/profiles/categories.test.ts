import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  CURRENT_MIGRATIONS,
  type SchemaMigration,
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup(
  migrations: readonly SchemaMigration[] = CURRENT_MIGRATIONS,
) {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-categories-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Test profile')
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations,
  })
  applications.push(application)
  return { application, profile, paths, registry }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('new profiles have stable two-level expense and income defaults translated in all three languages', async () => {
  const { application, profile, paths } = await setup()
  const original = application.queries.listCategories()
  const food = original.find((category) => category.seedKey === 'expense.food')!
  const shop = original.find(
    (category) => category.seedKey === 'expense.food.shop',
  )!
  expect(food).toMatchObject({
    name: 'Food',
    kind: 'expense',
    customName: null,
    parentId: null,
    translationKey: 'categories.default.food',
    archived: false,
  })
  expect(food.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  expect(shop).toMatchObject({
    name: 'Groceries',
    parentId: food.id,
    kind: 'expense',
  })
  expect(
    original
      .filter((category) => category.kind === 'income')
      .map((category) => category.name),
  ).toEqual(['Salary', 'Other income'])
  expect(
    original.find((category) => category.seedKey === 'expense.fees')?.name,
  ).toBe('Fees')
  for (const [language, foodName, shopName, feeName] of [
    ['hu', 'Élelmiszer', 'Bolt', 'Díjak'],
    ['de', 'Lebensmittel', 'Einkäufe', 'Gebühren'],
    ['en', 'Food', 'Groceries', 'Fees'],
  ] as const) {
    application.commands.updateSettings({ language })
    const categories = application.queries.listCategories()
    expect(categories.find((category) => category.id === food.id)?.name).toBe(
      foodName,
    )
    expect(categories.find((category) => category.id === shop.id)?.name).toBe(
      shopName,
    )
    expect(
      categories.find((category) => category.seedKey === 'expense.fees')?.name,
    ).toBe(feeName)
  }
  application.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listCategories()).toEqual(original)
})

test('custom category names win over translations and survive language switches and reopen', async () => {
  const { application, profile, paths } = await setup()
  const food = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.food')!
  const renamed = application.commands.renameCategory({
    id: food.id,
    name: '  Weekly food  ',
  })
  const custom = application.commands.createCategory({
    name: '  Gifts  ',
    kind: 'expense',
    parentId: null,
  })
  expect(renamed).toMatchObject({
    id: food.id,
    seedKey: 'expense.food',
    translationKey: 'categories.default.food',
    customName: 'Weekly food',
    name: 'Weekly food',
  })
  expect(custom).toMatchObject({
    customName: 'Gifts',
    name: 'Gifts',
    seedKey: null,
    translationKey: null,
    parentId: null,
  })
  application.commands.updateSettings({ language: 'hu' })
  expect(
    application.queries
      .listCategories()
      .find((category) => category.id === food.id)?.name,
  ).toBe('Weekly food')
  expect(
    application.queries
      .listCategories()
      .find((category) => category.id === custom.id)?.name,
  ).toBe('Gifts')
  application.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(
    reopened.queries
      .listCategories()
      .find((category) => category.id === food.id),
  ).toEqual(renamed)
  expect(
    reopened.queries
      .listCategories()
      .find((category) => category.id === custom.id),
  ).toEqual(custom)
})

test('only active two-level categories of the same kind can appear in expense or income pickers', async () => {
  const { application } = await setup()
  const parent = application.commands.createCategory({
    name: 'Trips',
    kind: 'expense',
    parentId: null,
  })
  const child = application.commands.createCategory({
    name: 'Tickets',
    kind: 'expense',
    parentId: parent.id,
  })
  const initial = application.queries.listCategories()
  for (const invalidParent of [
    child.id,
    initial.find((category) => category.kind === 'income')!.id,
  ]) {
    expect(() =>
      application.commands.createCategory({
        name: 'Invalid',
        kind: 'expense',
        parentId: invalidParent,
      }),
    ).toThrow('categories.error.parent')
    expect(application.queries.listCategories()).toEqual(initial)
  }
  application.commands.archiveCategory(parent.id)
  expect(
    application.queries
      .listCategories()
      .find((category) => category.id === child.id),
  ).toEqual(child)
  expect(
    application.queries
      .listCategoryOptions('expense')
      .map((category) => category.id),
  ).not.toContain(parent.id)
  expect(
    application.queries
      .listCategoryOptions('expense')
      .map((category) => category.id),
  ).not.toContain(child.id)
  expect(
    application.queries
      .listCategoryOptions('income')
      .map((category) => category.name),
  ).toEqual(['Salary', 'Other income'])
  expect(() =>
    application.commands.createCategory({
      name: 'Invalid',
      kind: 'expense',
      parentId: parent.id,
    }),
  ).toThrow('categories.error.parent')
})

test('reordering changes only sibling positions and persists across reopen', async () => {
  const { application, profile, paths } = await setup()
  const food = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.food')!
  const restaurant = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.food.restaurant')!
  application.commands.reorderCategory({ id: restaurant.id, sortOrder: 0 })
  expect(
    application.queries
      .listCategories()
      .filter((category) => category.parentId === food.id)
      .map((category) => category.name),
  ).toEqual(['Restaurants', 'Groceries'])
  const salary = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'income.salary')!
  application.commands.reorderCategory({ id: salary.id, sortOrder: 1 })
  expect(
    application.queries
      .listCategories()
      .filter((category) => category.kind === 'income')
      .map((category) => category.name),
  ).toEqual(['Other income', 'Salary'])
  const reordered = application.queries.listCategories()
  application.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listCategories()).toEqual(reordered)
})

test('deletion validates replacements before deleting and never orphans subcategories', async () => {
  const { application, profile, paths } = await setup()
  const source = application.commands.createCategory({
    name: 'Old',
    kind: 'expense',
    parentId: null,
  })
  const replacement = application.commands.createCategory({
    name: 'New',
    kind: 'expense',
    parentId: null,
  })
  const archived = application.commands.createCategory({
    name: 'Archived',
    kind: 'expense',
    parentId: null,
  })
  const hiddenChild = application.commands.createCategory({
    name: 'Hidden child',
    kind: 'expense',
    parentId: archived.id,
  })
  application.commands.archiveCategory(archived.id)
  const income = application.queries
    .listCategories()
    .find((category) => category.kind === 'income')!
  const initial = application.queries.listCategories()
  for (const replacementId of [
    source.id,
    income.id,
    archived.id,
    hiddenChild.id,
    'bad-id',
    '00000000-0000-4000-8000-000000000000',
  ]) {
    expect(() =>
      application.commands.deleteCategory({ id: source.id, replacementId }),
    ).toThrow()
    expect(application.queries.listCategories()).toEqual(initial)
  }
  expect(application.queries.hasCategoryTransactions(source.id)).toBe(false)
  application.commands.deleteCategory({
    id: source.id,
    replacementId: replacement.id,
  })
  expect(
    application.queries
      .listCategories()
      .find((category) => category.id === source.id),
  ).toBeUndefined()
  expect(
    application.queries
      .listCategories()
      .find((category) => category.id === replacement.id),
  ).toEqual(replacement)
  expect(() => application.queries.hasCategoryTransactions(source.id)).toThrow(
    'categories.error.notFound',
  )
  const food = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.food')!
  expect(() =>
    application.commands.deleteCategory({
      id: food.id,
      replacementId: replacement.id,
    }),
  ).toThrow('categories.error.children')
  application.commands.deleteCategory({ id: hiddenChild.id })
  application.commands.deleteCategory({ id: archived.id })
  const deleted = application.queries.listCategories()
  application.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listCategories()).toEqual(deleted)
})

test('the category migration seeds existing profiles in their saved language and reopen preserves customizations', async () => {
  const { application, profile, paths } = await setup(
    CURRENT_MIGRATIONS.slice(0, 3),
  )
  application.commands.updateSettings({ language: 'hu' })
  application.close()
  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(4)
  const food = upgraded.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.food')!
  expect(food.name).toBe('Élelmiszer')
  upgraded.commands.renameCategory({ id: food.id, name: 'My food' })
  upgraded.commands.archiveCategory(food.id)
  const fees = upgraded.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.fees')!
  upgraded.commands.reorderCategory({ id: fees.id, sortOrder: 0 })
  const health = upgraded.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.health')!
  upgraded.commands.deleteCategory({ id: health.id })
  const customized = upgraded.queries.listCategories()
  upgraded.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listCategories()).toEqual(customized)
})

test('invalid category commands leave the profile unchanged', async () => {
  const { application } = await setup()
  const initial = application.queries.listCategories()
  const valid = { name: 'New', kind: 'expense' as const, parentId: null }
  for (const invalid of [
    { name: '' },
    { name: ' ' },
    { name: 'x'.repeat(101) },
    { name: 42 },
    { name: null },
    { kind: 'transfer' },
    { parentId: 'bad-id' },
    { parentId: 42 },
  ]) {
    expect(() =>
      application.commands.createCategory({
        ...valid,
        ...invalid,
      } as typeof valid),
    ).toThrow()
    expect(application.queries.listCategories()).toEqual(initial)
  }
  for (const name of ['', ' ', 'x'.repeat(101)]) {
    expect(() =>
      application.commands.renameCategory({ id: initial[0].id, name }),
    ).toThrow('categories.error.name')
  }
  for (const sortOrder of [
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    1000,
  ]) {
    expect(() =>
      application.commands.reorderCategory({ id: initial[0].id, sortOrder }),
    ).toThrow('categories.error.order')
    expect(application.queries.listCategories()).toEqual(initial)
  }
})

test('category IDs and commands stay isolated between profiles', async () => {
  const { application, registry } = await setup()
  const category = application.commands.createCategory({
    name: 'First only',
    kind: 'expense',
    parentId: null,
  })
  const second = registry.createProfile('Second')
  const other = await openProfileApplication({
    profile: second,
    paths: registry.getProfilePaths(second.id),
    clock,
  })
  applications.push(other)
  const initial = other.queries.listCategories()
  expect(initial.map((entry) => entry.id)).not.toContain(category.id)
  for (const command of [
    () => other.commands.renameCategory({ id: category.id, name: 'Wrong' }),
    () => other.commands.archiveCategory(category.id),
    () => other.commands.reorderCategory({ id: category.id, sortOrder: 0 }),
    () => other.commands.deleteCategory({ id: category.id }),
    () => other.queries.hasCategoryTransactions(category.id),
    () =>
      other.commands.createCategory({
        name: 'Wrong parent',
        kind: 'expense',
        parentId: category.id,
      }),
    () =>
      other.commands.deleteCategory({
        id: initial[0].id,
        replacementId: category.id,
      }),
  ])
    expect(command).toThrow('categories.error.notFound')
  expect(other.queries.listCategories()).toEqual(initial)
  expect(
    application.queries
      .listCategories()
      .find((entry) => entry.id === category.id),
  ).toEqual(category)
})
