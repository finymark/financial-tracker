import type { MessageKey } from '../i18n'

export function reportError(error: unknown): MessageKey {
  return String(error).includes('reports.error.range')
    ? 'reports.error.range'
    : 'reports.error'
}
