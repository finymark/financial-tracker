import Database from 'better-sqlite3'

export function normalizePayeeKey(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('und').normalize('NFC')
}

export function normalizePayeeAliasKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
    .normalize('NFC')
}

function foldText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
}

export function openDatabase(
  path: string,
  options?: Database.Options,
): Database.Database {
  const database = new Database(path, options)
  database.pragma('foreign_keys = ON')
  database.function('fold_text', { deterministic: true }, foldText)
  database.function('payee_key', { deterministic: true }, (value: unknown) =>
    normalizePayeeKey(String(value ?? '')),
  )
  database.function(
    'payee_alias_key',
    { deterministic: true },
    (value: unknown) => normalizePayeeAliasKey(String(value ?? '')),
  )
  return database
}
