import Database from 'better-sqlite3'
import { foldTextKey, payeeAliasKey, payeeKey } from '../shared/text-keys'

export function openDatabase(
  path: string,
  options?: Database.Options,
): Database.Database {
  const database = new Database(path, options)
  database.pragma('foreign_keys = ON')
  database.function('fold_text', { deterministic: true }, (value: unknown) =>
    foldTextKey(String(value ?? '')),
  )
  database.function('payee_key', { deterministic: true }, (value: unknown) =>
    payeeKey(String(value ?? '')),
  )
  database.function(
    'payee_alias_key',
    { deterministic: true },
    (value: unknown) => payeeAliasKey(String(value ?? '')),
  )
  return database
}
