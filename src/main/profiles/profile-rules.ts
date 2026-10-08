import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CategorisationAutofill,
  CategorisationRule,
  CategorisationRuleDraft,
  CategorisationRuleDraftInput,
  CategorisationRuleMatch,
  CreateCategorisationRuleInput,
  ReorderCategorisationRuleInput,
  UpdateCategorisationRuleInput,
} from '../../shared/rules'
import { firstMatchingCategorisationRule } from '../../shared/rules'
import type { Tag } from '../../shared/tags'
import type { TransactionKind } from '../../shared/transactions'
import { getCategory } from './profile-categories'
import { findPayeeByName, getPayee } from './profile-payees'
import { getLinesTags } from './profile-tags'
import {
  parseCategorisationRuleDraftInput,
  parseCategorisationRuleInput,
  parseReorderCategorisationRuleInput,
  parseUpdateCategorisationRuleInput,
  validateCategorisationRuleId,
} from './rule-validation'

interface StoredRule {
  id: string
  enabled: number
  sortOrder: number
  payeeId: string | null
  payeeName: string | null
  textContains: string | null
  accountId: string | null
  minAmountMinor: number | null
  maxAmountMinor: number | null
  amountCurrency: 'HUF' | 'CHF' | null
  actionPayeeId: string | null
  actionPayeeName: string | null
  categoryId: string | null
  categoryKind: TransactionKind | null
  createdAt: string
  updatedAt: string
}

const RULE_SELECT = `
  SELECT categorisation_rules.id, categorisation_rules.enabled,
    categorisation_rules.sort_order AS sortOrder,
    categorisation_rules.payee_id AS payeeId, payees.name AS payeeName,
    categorisation_rules.text_contains AS textContains,
    categorisation_rules.account_id AS accountId,
    categorisation_rules.min_amount_minor AS minAmountMinor,
    categorisation_rules.max_amount_minor AS maxAmountMinor,
    categorisation_rules.amount_currency AS amountCurrency,
    categorisation_rules.action_payee_id AS actionPayeeId,
    action_payees.name AS actionPayeeName,
    categorisation_rules.category_id AS categoryId,
    categories.kind AS categoryKind,
    categorisation_rules.created_at AS createdAt,
    categorisation_rules.updated_at AS updatedAt
  FROM categorisation_rules
  LEFT JOIN payees ON payees.id = categorisation_rules.payee_id
  LEFT JOIN payees AS action_payees
    ON action_payees.id = categorisation_rules.action_payee_id
  LEFT JOIN categories ON categories.id = categorisation_rules.category_id`

function ruleTags(
  database: Database.Database,
  ruleIds: readonly string[],
): Map<string, Tag[]> {
  const result = new Map<string, Tag[]>()
  if (ruleIds.length === 0) return result
  const rows = database
    .prepare(
      `SELECT categorisation_rule_tags.rule_id AS ruleId,
        tags.id, tags.name, tags.created_at AS createdAt
       FROM categorisation_rule_tags
       JOIN tags ON tags.id = categorisation_rule_tags.tag_id
       WHERE categorisation_rule_tags.rule_id IN (${ruleIds.map(() => '?').join(',')})
       ORDER BY tags.normalized_name, tags.id`,
    )
    .all(...ruleIds) as (Tag & { ruleId: string })[]
  for (const { ruleId, ...tag } of rows) {
    const tags = result.get(ruleId) ?? []
    tags.push(tag)
    result.set(ruleId, tags)
  }
  return result
}

function rowsToRules(
  database: Database.Database,
  rows: StoredRule[],
): CategorisationRule[] {
  const tags = ruleTags(
    database,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({
    ...row,
    enabled: row.enabled === 1,
    tags: tags.get(row.id) ?? [],
  }))
}

export function listCategorisationRules(
  database: Database.Database,
): CategorisationRule[] {
  const rows = database
    .prepare(`${RULE_SELECT} ORDER BY sortOrder, categorisation_rules.rowid`)
    .all() as StoredRule[]
  return rowsToRules(database, rows)
}

export function getCategorisationRule(
  database: Database.Database,
  id: string,
): CategorisationRule {
  const row = database
    .prepare(`${RULE_SELECT} WHERE categorisation_rules.id = ?`)
    .get(validateCategorisationRuleId(id)) as StoredRule | undefined
  if (!row) throw new Error('rules.error.notFound')
  return rowsToRules(database, [row])[0]
}

function validateReferences(
  database: Database.Database,
  input: CreateCategorisationRuleInput,
  current?: CategorisationRule,
): void {
  if (input.payeeId !== null && input.payeeId !== current?.payeeId)
    getPayee(database, input.payeeId)
  if (
    input.actionPayeeId != null &&
    input.actionPayeeId !== current?.actionPayeeId
  )
    getPayee(database, input.actionPayeeId)
  if (
    input.accountId !== null &&
    (input.accountId !== current?.accountId ||
      input.amountCurrency !== current?.amountCurrency)
  ) {
    const account = database
      .prepare('SELECT archived, currency FROM accounts WHERE id = ?')
      .get(input.accountId) as
      { archived: number; currency: 'HUF' | 'CHF' } | undefined
    if (
      !account ||
      (input.accountId !== current?.accountId && account.archived)
    )
      throw new Error('rules.error.reference')
    if (
      input.amountCurrency !== null &&
      input.amountCurrency !== account.currency
    )
      throw new Error('rules.error.amount')
  }
  if (input.categoryId !== null && input.categoryId !== current?.categoryId) {
    const category = getCategory(database, input.categoryId)
    const parentArchived =
      category.parentId !== null &&
      getCategory(database, category.parentId).archived !== 0
    if (category.archived || parentArchived)
      throw new Error('rules.error.reference')
  }
  for (const tagId of input.tagIds) {
    if (current?.tags.some((tag) => tag.id === tagId)) continue
    if (!database.prepare('SELECT 1 FROM tags WHERE id = ?').get(tagId))
      throw new Error('rules.error.reference')
  }
}

function setRuleTags(
  database: Database.Database,
  ruleId: string,
  tagIds: readonly string[],
): void {
  database
    .prepare('DELETE FROM categorisation_rule_tags WHERE rule_id = ?')
    .run(ruleId)
  const insert = database.prepare(
    'INSERT INTO categorisation_rule_tags (rule_id, tag_id) VALUES (?, ?)',
  )
  for (const tagId of tagIds) insert.run(ruleId, tagId)
}

export function createCategorisationRule(
  database: Database.Database,
  value: CreateCategorisationRuleInput,
  clock: () => Date,
): CategorisationRule {
  const input = parseCategorisationRuleInput(value)
  validateReferences(database, input)
  const next = database
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM categorisation_rules',
    )
    .get() as { value: number }
  const id = randomUUID()
  const timestamp = clock().toISOString()
  database
    .prepare(
      `INSERT INTO categorisation_rules
       (id, enabled, sort_order, payee_id, text_contains, account_id,
        min_amount_minor, max_amount_minor, amount_currency, action_payee_id,
        category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      Number(input.enabled),
      next.value,
      input.payeeId,
      input.textContains,
      input.accountId,
      input.minAmountMinor,
      input.maxAmountMinor,
      input.amountCurrency,
      input.actionPayeeId,
      input.categoryId,
      timestamp,
      timestamp,
    )
  setRuleTags(database, id, input.tagIds)
  return getCategorisationRule(database, id)
}

export function updateCategorisationRule(
  database: Database.Database,
  value: UpdateCategorisationRuleInput,
  clock: () => Date,
): CategorisationRule {
  const input = parseUpdateCategorisationRuleInput(value)
  const current = getCategorisationRule(database, input.id)
  validateReferences(database, input, current)
  database
    .prepare(
      `UPDATE categorisation_rules SET enabled = ?, payee_id = ?,
        text_contains = ?, account_id = ?, min_amount_minor = ?,
        max_amount_minor = ?, amount_currency = ?, action_payee_id = ?,
        category_id = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      Number(input.enabled),
      input.payeeId,
      input.textContains,
      input.accountId,
      input.minAmountMinor,
      input.maxAmountMinor,
      input.amountCurrency,
      input.actionPayeeId,
      input.categoryId,
      clock().toISOString(),
      input.id,
    )
  setRuleTags(database, input.id, input.tagIds)
  return getCategorisationRule(database, input.id)
}

function normalizeRuleOrder(database: Database.Database): void {
  const rows = database
    .prepare('SELECT id FROM categorisation_rules ORDER BY sort_order, rowid')
    .all() as { id: string }[]
  const update = database.prepare(
    'UPDATE categorisation_rules SET sort_order = ? WHERE id = ?',
  )
  rows.forEach((row, index) => update.run(index, row.id))
}

export function deleteCategorisationRule(
  database: Database.Database,
  id: string,
): void {
  const rule = getCategorisationRule(database, id)
  database.prepare('DELETE FROM categorisation_rules WHERE id = ?').run(rule.id)
  normalizeRuleOrder(database)
}

export function reorderCategorisationRule(
  database: Database.Database,
  value: ReorderCategorisationRuleInput,
): void {
  const input = parseReorderCategorisationRuleInput(value)
  const rule = getCategorisationRule(database, input.id)
  const rows = database
    .prepare('SELECT id FROM categorisation_rules ORDER BY sort_order, rowid')
    .all() as { id: string }[]
  if (input.sortOrder >= rows.length) throw new Error('rules.error.order')
  const reordered = rows.filter(({ id }) => id !== rule.id)
  reordered.splice(input.sortOrder, 0, { id: rule.id })
  const update = database.prepare(
    'UPDATE categorisation_rules SET sort_order = ? WHERE id = ?',
  )
  reordered.forEach((row, index) => update.run(index, row.id))
}

interface MatchRule extends CategorisationRuleMatch {
  tags: Tag[]
  actionPayeeName: string | null
}

function matchRules(database: Database.Database): MatchRule[] {
  return listCategorisationRules(database).map((rule) => ({
    ...rule,
    tagIds: rule.tags.map((tag) => tag.id),
  }))
}

function resolvedDraft(
  database: Database.Database,
  value: CategorisationRuleDraftInput,
): CategorisationRuleDraft {
  const input = parseCategorisationRuleDraftInput(value)
  const payee = findPayeeByName(database, input.payeeName)
  const account = database
    .prepare('SELECT currency FROM accounts WHERE id = ?')
    .get(input.accountId) as { currency: 'HUF' | 'CHF' } | undefined
  if (!account) throw new Error('rules.error.reference')
  return {
    accountId: input.accountId,
    kind: input.kind,
    totalMinor: input.totalMinor,
    currency: account.currency,
    canonicalPayeeId: payee?.id ?? null,
    canonicalPayeeName: payee?.name ?? input.payeeName,
    note: input.note,
  }
}

function emptyAutofill(): CategorisationAutofill {
  return {
    source: 'none',
    ruleId: null,
    payeeId: null,
    payeeName: null,
    categoryId: null,
    tags: [],
  }
}

export function getCategorisationAutofill(
  database: Database.Database,
  value: CategorisationRuleDraftInput,
): CategorisationAutofill {
  const draft = resolvedDraft(database, value)
  const rule = firstMatchingCategorisationRule(matchRules(database), draft)
  if (rule) {
    return {
      source: 'rule',
      ruleId: rule.id,
      payeeId: rule.actionPayeeId,
      payeeName: rule.actionPayeeName,
      categoryId: rule.categoryId,
      tags: rule.tags,
    }
  }
  if (draft.canonicalPayeeId === null) return emptyAutofill()
  const latest = database
    .prepare(
      `SELECT transactions.id
       FROM transactions
       WHERE transactions.payee_id = ? AND transactions.kind = ?
         AND (SELECT COUNT(*) FROM transaction_lines
              WHERE transaction_lines.transaction_id = transactions.id) = 1
       ORDER BY transactions.date DESC, transactions.created_at DESC,
         transactions.id DESC LIMIT 1`,
    )
    .get(draft.canonicalPayeeId, draft.kind) as { id: string } | undefined
  if (!latest) return emptyAutofill()
  const line = database
    .prepare(
      `SELECT id, category_id AS categoryId FROM transaction_lines
       WHERE transaction_id = ?`,
    )
    .get(latest.id) as { id: string; categoryId: string | null }
  return {
    source: 'lastUsed',
    ruleId: null,
    payeeId: null,
    payeeName: null,
    categoryId: line.categoryId,
    tags: getLinesTags(database, [line.id]).get(line.id) ?? [],
  }
}
