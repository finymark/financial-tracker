import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { Tag } from '../../shared/tags'
import { tagKey } from '../../shared/text-keys'

export function listTags(database: Database.Database): Tag[] {
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
  if (lineIds.length === 0) return result
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
  database
    .prepare('DELETE FROM transaction_line_tags WHERE line_id = ?')
    .run(lineId)
  for (const name of names) {
    const tag = getOrCreateTag(database, name, timestamp)
    database
      .prepare(
        'INSERT OR IGNORE INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
      )
      .run(lineId, tag.id)
  }
}

export function getOrCreateTag(
  database: Database.Database,
  name: string,
  timestamp: string,
): { id: string } {
  const normalizedName = tagKey(name)
  const existing = database
    .prepare('SELECT id FROM tags WHERE normalized_name = ?')
    .get(normalizedName) as { id: string } | undefined
  if (existing) return existing
  const tag = { id: randomUUID() }
  database
    .prepare(
      'INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(tag.id, name, normalizedName, timestamp)
  return tag
}
