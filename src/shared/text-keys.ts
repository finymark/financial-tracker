/** Canonical key for payee names and tags: case-insensitive, accent-sensitive. */
export function textNameKey(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('und').normalize('NFC')
}

export const payeeKey = textNameKey
export const tagKey = textNameKey

/** Case- and diacritic-insensitive key used by payee aliases and free text. */
export function foldTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
    .normalize('NFC')
}

export const payeeAliasKey = foldTextKey
