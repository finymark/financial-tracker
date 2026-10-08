import type Database from 'better-sqlite3'
import type {
  CategorisationRule,
  CategorisationRuleApplicationPreview,
  CreateCategorisationRuleInput,
  ReorderCategorisationRuleInput,
  UpdateCategorisationRuleInput,
} from '../../shared/rules'
import {
  applyPlannedCategorisationRules,
  createCategorisationRule,
  deleteCategorisationRule,
  planCategorisationRuleApplication,
  reorderCategorisationRule,
  updateCategorisationRule,
  type PlannedRuleApplication,
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
  const available = database
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'categorisation_rules'",
    )
    .get()
  if (!available) return null
  return {
    rules: database
      .prepare(
        `SELECT id, enabled, sort_order AS sortOrder, payee_id AS payeeId,
          text_contains AS textContains, account_id AS accountId,
          min_amount_minor AS minAmountMinor, max_amount_minor AS maxAmountMinor,
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
      min_amount_minor, max_amount_minor, category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export function applyCategorisationRulesUndoableCommand(
  database: Database.Database,
): UndoableCommand<
  PlannedRuleApplication[],
  null,
  CategorisationRuleApplicationPreview
> {
  let plan: PlannedRuleApplication[] = []
  return {
    captureBefore: () => {
      plan = planCategorisationRuleApplication(database)
      return plan
    },
    execute: () => applyPlannedCategorisationRules(database, plan),
    captureAfter: () => null,
    restoreBefore: (before) => {
      const deleteTags = database.prepare(
        'DELETE FROM transaction_line_tags WHERE line_id = ?',
      )
      const insertTag = database.prepare(
        'INSERT INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
      )
      const updateCategory = database.prepare(
        'UPDATE transaction_lines SET category_id = ? WHERE id = ?',
      )
      for (const item of before) {
        updateCategory.run(item.previousCategoryId, item.lineId)
        deleteTags.run(item.lineId)
        for (const tagId of item.previousTagIds)
          insertTag.run(item.lineId, tagId)
      }
    },
  }
}
