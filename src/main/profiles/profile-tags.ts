import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { Tag } from '../../shared/tags'
import { normalizePayeeKey } from '../db'

// Previous-schema application fixtures still exercise migration behavior.
export function hasTagSchema(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tags'",
      )
      .get(),
  )
}

export function listTags(database: Database.Database): Tag[] {
  if (!hasTagSchema(database)) return []
  return database
    .prepare(
      'SELECT id, name, created_at AS createdAt FROM tags ORDER BY normalized_name, id',
    )
    .all() as Tag[]
}

export function getLinesTags(
  database: Database.Database,
  lineIds: readonly string[],
): Map<string, Tag[]> {
  const result = new Map<string, Tag[]>()
  if (lineIds.length === 0 || !hasTagSchema(database)) return result
  const rows = database
    .prepare(
      `SELECT transaction_line_tags.line_id AS lineId,
      tags.id, tags.name, tags.created_at AS createdAt
    FROM tags JOIN transaction_line_tags ON transaction_line_tags.tag_id = tags.id
    WHERE transaction_line_tags.line_id IN (${lineIds.map(() => '?').join(',')})
    ORDER BY tags.normalized_name, tags.id`,
    )
    .all(...lineIds) as (Tag & { lineId: string })[]
  for (const { lineId, ...tag } of rows) {
    const tags = result.get(lineId) ?? []
    tags.push(tag)
    result.set(lineId, tags)
  }
  return result
}

export function getLineTags(
  database: Database.Database,
  lineId: string,
): Tag[] {
  return getLinesTags(database, [lineId]).get(lineId) ?? []
}

export function setLineTags(
  database: Database.Database,
  lineId: string,
  names: string[],
  timestamp: string,
): void {
  if (!hasTagSchema(database)) {
    if (names.length) throw new Error('tags.error.notFound')
    return
  }
  database
    .prepare('DELETE FROM transaction_line_tags WHERE line_id = ?')
    .run(lineId)
  for (const name of names) {
    const normalizedName = normalizePayeeKey(name)
    let tag = database
      .prepare('SELECT id FROM tags WHERE normalized_name = ?')
      .get(normalizedName) as { id: string } | undefined
    if (!tag) {
      tag = { id: randomUUID() }
      database
        .prepare(
          'INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(tag.id, name, normalizedName, timestamp)
    }
    database
      .prepare(
        'INSERT OR IGNORE INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
      )
      .run(lineId, tag.id)
  }
}
