import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { openDatabase } from './db'

test('writes and reads SQLite data from a temporary file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-test-'))
  const path = join(directory, 'round-trip.sqlite')
  const database = openDatabase(path)

  try {
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(
      database.prepare("SELECT fold_text('ÁRVÍZ') AS value").get(),
    ).toEqual({ value: 'arviz' })
    database.exec('CREATE TABLE example (value TEXT NOT NULL)')
    database.prepare('INSERT INTO example (value) VALUES (?)').run('round-trip')
    database.close()

    const reopened = openDatabase(path)
    try {
      expect(reopened.prepare('SELECT value FROM example').get()).toEqual({
        value: 'round-trip',
      })
    } finally {
      reopened.close()
    }
  } finally {
    if (database.open) database.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
