import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CreateTemplateInput,
  TransactionTemplate,
  UpdateTemplateInput,
  SaveTransactionAsTemplateInput,
} from '../../shared/templates'
import { templateFields, validateTemplateId } from './template-validation'
import { getTransaction } from './profile-transactions'
import { validateTransactionId } from './transaction-validation'
import { tagKey } from '../../shared/text-keys'

interface StoredTemplate extends Omit<
  TransactionTemplate,
  'tagNames' | 'excluded'
> {
  excluded: number
}
const SELECT = `SELECT id, name, kind, account_id AS accountId,
  total_minor AS totalMinor, payee_name AS payeeName, category_id AS categoryId,
  note, excluded, created_at AS createdAt, updated_at AS updatedAt
  FROM transaction_templates`

function views(
  database: Database.Database,
  rows: readonly StoredTemplate[],
): TransactionTemplate[] {
  if (rows.length === 0) return []
  const associations = database
    .prepare(
      `SELECT transaction_template_tags.template_id AS templateId, tags.name
       FROM transaction_template_tags
       JOIN tags ON tags.id = transaction_template_tags.tag_id
       WHERE transaction_template_tags.template_id IN (${rows.map(() => '?').join(',')})
       ORDER BY tags.normalized_name, tags.id`,
    )
    .all(...rows.map((row) => row.id)) as { templateId: string; name: string }[]
  return rows.map((row) => ({
    ...row,
    excluded: row.excluded === 1,
    tagNames: associations
      .filter((association) => association.templateId === row.id)
      .map((association) => association.name),
  }))
}

export function listTemplates(
  database: Database.Database,
): TransactionTemplate[] {
  const rows = database
    .prepare(`${SELECT} ORDER BY name COLLATE NOCASE, id`)
    .all() as StoredTemplate[]
  return views(database, rows)
}

export function getTemplate(
  database: Database.Database,
  id: string,
): TransactionTemplate {
  const row = database
    .prepare(`${SELECT} WHERE id = ?`)
    .get(validateTemplateId(id)) as StoredTemplate | undefined
  if (!row) throw new Error('templates.error.notFound')
  return views(database, [row])[0]
}

export function storeTemplate(
  database: Database.Database,
  template: TransactionTemplate,
): void {
  database
    .prepare(
      `INSERT INTO transaction_templates
    (id, name, kind, account_id, total_minor, payee_name, category_id, note,
     excluded, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
      account_id = excluded.account_id, total_minor = excluded.total_minor,
      payee_name = excluded.payee_name, category_id = excluded.category_id,
      note = excluded.note, excluded = excluded.excluded,
      created_at = excluded.created_at, updated_at = excluded.updated_at`,
    )
    .run(
      template.id,
      template.name,
      template.kind,
      template.accountId,
      template.totalMinor,
      template.payeeName,
      template.categoryId,
      template.note,
      Number(template.excluded),
      template.createdAt,
      template.updatedAt,
    )
  database
    .prepare('DELETE FROM transaction_template_tags WHERE template_id = ?')
    .run(template.id)
  const insertTag = database.prepare(
    `INSERT INTO transaction_template_tags (template_id, tag_id)
     SELECT ?, id FROM tags WHERE normalized_name = ?`,
  )
  const seen = new Set<string>()
  for (const name of template.tagNames) {
    const key = tagKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    insertTag.run(template.id, key)
  }
}

export function validateTemplateReferences(
  database: Database.Database,
  template: Pick<TransactionTemplate, 'accountId' | 'categoryId' | 'kind'>,
): void {
  if (
    template.accountId &&
    !database
      .prepare('SELECT id FROM accounts WHERE id = ?')
      .get(template.accountId)
  ) {
    throw new Error('transactions.error.account')
  }
  if (template.categoryId) {
    const category = database
      .prepare('SELECT kind FROM categories WHERE id = ?')
      .get(template.categoryId) as { kind: string } | undefined
    if (
      !category ||
      (template.kind !== null && category.kind !== template.kind)
    )
      throw new Error('transactions.error.category')
  }
}

export function createTemplate(
  database: Database.Database,
  input: CreateTemplateInput,
  clock: () => Date,
): TransactionTemplate {
  const timestamp = clock().toISOString()
  const template = {
    ...templateFields(input),
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  validateTemplateReferences(database, template)
  storeTemplate(database, template)
  return getTemplate(database, template.id)
}

export function updateTemplate(
  database: Database.Database,
  input: UpdateTemplateInput,
  clock: () => Date,
): TransactionTemplate {
  const current = getTemplate(database, input.id)
  const template = {
    ...current,
    ...templateFields(input),
    updatedAt: clock().toISOString(),
  }
  validateTemplateReferences(database, template)
  storeTemplate(database, template)
  return getTemplate(database, input.id)
}

export function deleteTemplate(database: Database.Database, id: string): void {
  getTemplate(database, id)
  database.prepare('DELETE FROM transaction_templates WHERE id = ?').run(id)
}

export function saveTransactionAsTemplate(
  database: Database.Database,
  input: SaveTransactionAsTemplateInput,
  clock: () => Date,
): TransactionTemplate {
  const source = getTransaction(
    database,
    validateTransactionId(input.transactionId),
  )
  if (source.lines.length !== 1) throw new Error('templates.error.split')
  return createTemplate(
    database,
    {
      name: input.name,
      kind: source.kind,
      accountId: source.accountId,
      totalMinor: source.totalMinor,
      payeeName: source.payeeName,
      categoryId: source.line.categoryId,
      tagNames: source.line.tags.map((tag) => tag.name),
      note: source.line.note,
      excluded: source.excluded,
    },
    clock,
  )
}
