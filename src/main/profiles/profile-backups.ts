import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { ProfileBackup } from '../../shared/profiles'
import { openDatabase } from '../db'
import { formatBackupTimestamp, parseBackupTimestamp } from './backup-timestamp'

const BACKUP_FILE_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-(\d{6})-([0-9a-f-]{36})\.sqlite$/

interface BackupFile extends ProfileBackup {
  filename: string
}

export function listBackupFiles(directory: string): BackupFile[] {
  mkdirSync(directory, { recursive: true })
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry): BackupFile[] => {
      const match = BACKUP_FILE_PATTERN.exec(entry.name)
      if (!entry.isFile() || !match) return []
      const timestamp = match[1]
      const createdAt = parseBackupTimestamp(timestamp)
      return [{ id: match[3], createdAt, filename: entry.name }]
    })
    .sort((first, second) => second.filename.localeCompare(first.filename))
}

export function verifySqliteBackup(
  path: string,
  validate: (database: Database.Database) => void,
): void {
  const backup = openDatabase(path, { readonly: true, fileMustExist: true })
  try {
    if (backup.pragma('quick_check', { simple: true }) !== 'ok') {
      throw new Error('SQLite quick_check failed for the backup')
    }
    validate(backup)
  } finally {
    backup.close()
  }
}

export async function createStartupBackup(
  database: Database.Database,
  directory: string,
  clock: () => Date,
): Promise<void> {
  const existing = listBackupFiles(directory)
  const timestamp = formatBackupTimestamp(clock())
  const lastAtTimestamp = existing.find((backup) =>
    backup.filename.startsWith(`${timestamp}-`),
  )
  const sequence = lastAtTimestamp
    ? Number(lastAtTimestamp.filename.slice(25, 31)) + 1
    : 0
  const filename = `${timestamp}-${String(sequence).padStart(6, '0')}-${randomUUID()}.sqlite`
  const path = join(directory, filename)
  try {
    await database.backup(path)
    verifySqliteBackup(path, () => {})
  } catch (error) {
    rmSync(path, { force: true })
    throw new Error('backups.error.create', {
      cause: error,
    })
  }
  for (const backup of listBackupFiles(directory).slice(10)) {
    rmSync(join(directory, backup.filename))
  }
}
