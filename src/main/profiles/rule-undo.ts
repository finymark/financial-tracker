import type Database from 'better-sqlite3'
import type {
  CategorisationRule,
  CreateCategorisationRuleInput,
  ReorderCategorisationRuleInput,
  UpdateCategorisationRuleInput,
} from '../../shared/rules'
import {
  createCategorisationRule,
  deleteCategorisationRule,
  reorderCategorisationRule,
  updateCategorisationRule,
} from './profile-rules'
import type { UndoableCommand } from './undo-history'

interface StoredRuleImage {
  id: string
  enabled: number
  sortOrder: number
  payeeId: string | null
  textContains: string | null
  accountId: string | null
  minAmountMinor: number | null
  maxAmountMinor: number | null
  amountCurrency: 'HUF' | 'CHF' | null
  actionPayeeId: string | null
  categoryId: string | null
  createdAt: string
  updatedAt: string
}

export interface CategorisationRulesImage {
  rules: StoredRuleImage[]
  tags: { ruleId: string; tagId: string }[]
}

export function captureCategorisationRules(
  database: Database.Database,
): CategorisationRulesImage | null {
  return {
    rules: database
      .prepare(
        `SELECT id, enabled, sort_order AS sortOrder, payee_id AS payeeId,
          text_contains AS textContains, account_id AS accountId,
          min_amount_minor AS minAmountMinor, max_amount_minor AS maxAmountMinor,
          amount_currency AS amountCurrency, action_payee_id AS actionPayeeId,
          category_id AS categoryId, created_at AS createdAt,
          updated_at AS updatedAt
         FROM categorisation_rules ORDER BY sort_order, rowid`,
      )
      .all() as StoredRuleImage[],
    tags: database
      .prepare(
        `SELECT rule_id AS ruleId, tag_id AS tagId
         FROM categorisation_rule_tags ORDER BY rule_id, tag_id`,
      )
      .all() as { ruleId: string; tagId: string }[],
  }
}

export function restoreCategorisationRules(
  database: Database.Database,
  image: CategorisationRulesImage | null,
): void {
  if (image === null) return
  database.prepare('DELETE FROM categorisation_rules').run()
  const insertRule = database.prepare(
    `INSERT INTO categorisation_rules
     (id, enabled, sort_order, payee_id, text_contains, account_id,
      min_amount_minor, max_amount_minor, amount_currency, action_payee_id,
      category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const rule of image.rules) {
    insertRule.run(
      rule.id,
      rule.enabled,
      rule.sortOrder,
      rule.payeeId,
      rule.textContains,
      rule.accountId,
      rule.minAmountMinor,
      rule.maxAmountMinor,
      rule.amountCurrency,
      rule.actionPayeeId,
      rule.categoryId,
      rule.createdAt,
      rule.updatedAt,
    )
  }
  const insertTag = database.prepare(
    'INSERT INTO categorisation_rule_tags (rule_id, tag_id) VALUES (?, ?)',
  )
  for (const tag of image.tags) insertTag.run(tag.ruleId, tag.tagId)
}

function rulesCommand<Result>(
  database: Database.Database,
  execute: () => Result,
): UndoableCommand<
  CategorisationRulesImage | null,
  CategorisationRulesImage | null,
  Result
> {
  return {
    captureBefore: () => captureCategorisationRules(database),
    execute,
    captureAfter: () => captureCategorisationRules(database),
    restoreBefore: (before) => restoreCategorisationRules(database, before),
  }
}

export function createCategorisationRuleUndoableCommand(
  database: Database.Database,
  input: CreateCategorisationRuleInput,
  clock: () => Date,
): UndoableCommand<
  CategorisationRulesImage | null,
  CategorisationRulesImage | null,
  CategorisationRule
> {
  return rulesCommand(database, () =>
    createCategorisationRule(database, input, clock),
  )
}

export function updateCategorisationRuleUndoableCommand(
  database: Database.Database,
  input: UpdateCategorisationRuleInput,
  clock: () => Date,
): UndoableCommand<
  CategorisationRulesImage | null,
  CategorisationRulesImage | null,
  CategorisationRule
> {
  return rulesCommand(database, () =>
    updateCategorisationRule(database, input, clock),
  )
}

export function deleteCategorisationRuleUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<
  CategorisationRulesImage | null,
  CategorisationRulesImage | null,
  void
> {
  return rulesCommand(database, () => deleteCategorisationRule(database, id))
}

export function reorderCategorisationRuleUndoableCommand(
  database: Database.Database,
  input: ReorderCategorisationRuleInput,
): UndoableCommand<
  CategorisationRulesImage | null,
  CategorisationRulesImage | null,
  void
> {
  return rulesCommand(database, () =>
    reorderCategorisationRule(database, input),
  )
}
