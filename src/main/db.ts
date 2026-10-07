import Database from 'better-sqlite3'
import type { DatabasePing } from '../shared/ipc'

export function openDatabase(path: string): Database.Database {
  return new Database(path)
}

export function pingDatabase(database: Database.Database): DatabasePing {
  const row = database.prepare("SELECT 'ok' AS result").get() as {
    result: DatabasePing
  }
  return row.result
}
