import { UUID_PATTERN } from '../../shared/validation'

export function validateTagId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('tags.error.notFound')
  }
  return value
}

export function validateTagName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new Error('tags.error.name')
  }
  return value.trim()
}

export function validateTagNames(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('tags.error.name')
  return Array.from(value, validateTagName)
}
