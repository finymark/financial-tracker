import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CreateTemplateInput,
  TransactionTemplate,
} from '../../shared/templates'
import { templateFields, validateTemplateId } from './template-validation'

interface StoredTemplate extends Omit<TransactionTemplate, 'tagNames'> {
  tagNames: string
}
const SELECT = `SELECT id, name, kind, account_id AS accountId,
  total_minor AS totalMinor, payee_name AS payeeName, category_id AS categoryId,
  tag_names AS tagNames, note, created_at AS createdAt, updated_at AS updatedAt
  FROM transaction_templates`

function view(row: StoredTemplate): TransactionTemplate {
  return { ...row, tagNames: JSON.parse(row.tagNames) as string[] }
}

export function listTemplates(
  database: Database.Database,
): TransactionTemplate[] {
  return (
    database
      .prepare(`${SELECT} ORDER BY name COLLATE NOCASE, id`)
      .all() as StoredTemplate[]
  ).map(view)
}

export function getTemplate(
  database: Database.Database,
  id: string,
): TransactionTemplate {
  const row = database
    .prepare(`${SELECT} WHERE id = ?`)
    .get(validateTemplateId(id)) as StoredTemplate | undefined
  if (!row) throw new Error('templates.error.notFound')
  return view(row)
}

export function storeTemplate(
  database: Database.Database,
  template: TransactionTemplate,
): void {
  database
    .prepare(
      `INSERT INTO transaction_templates
    (id, name, kind, account_id, total_minor, payee_name, category_id, tag_names, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
      account_id = excluded.account_id, total_minor = excluded.total_minor,
      payee_name = excluded.payee_name, category_id = excluded.category_id,
      tag_names = excluded.tag_names, note = excluded.note,
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
      JSON.stringify(template.tagNames),
      template.note,
      template.createdAt,
      template.updatedAt,
    )
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
