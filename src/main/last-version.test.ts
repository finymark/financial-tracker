import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { LastVersionFile } from './last-version'

const directories: string[] = []

function temporaryUserData(): string {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-version-'))
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('a fresh install records its version without reporting an update', () => {
  const directory = temporaryUserData()
  const file = new LastVersionFile(directory)

  expect(file.recordCurrentVersion('0.5.1')).toBeNull()
  expect(
    JSON.parse(readFileSync(join(directory, 'last-version.json'), 'utf8')),
  ).toEqual({ version: '0.5.1' })
})

test('a changed previous version is reported once and the current version is recorded', () => {
  const directory = temporaryUserData()
  const file = new LastVersionFile(directory)
  expect(file.recordCurrentVersion('0.5.0')).toBeNull()

  expect(file.recordCurrentVersion('0.5.1')).toBe('0.5.1')
  expect(file.recordCurrentVersion('0.5.1')).toBeNull()
})

test('corrupt previous data degrades to a fresh run and is replaced', () => {
  const directory = temporaryUserData()
  const path = join(directory, 'last-version.json')
  writeFileSync(path, '{not json')

  expect(
    new LastVersionFile(directory).recordCurrentVersion('0.5.1'),
  ).toBeNull()
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ version: '0.5.1' })
})

test('read and write failures degrade to no previous version', () => {
  const directory = temporaryUserData()
  const path = join(directory, 'last-version.json')
  const readFailure = vi.fn(() => {
    throw new Error('read failed')
  })
  const writeFailure = vi.fn(() => {
    throw new Error('write failed')
  })

  expect(
    new LastVersionFile(directory, {
      readFile: readFailure,
    }).recordCurrentVersion('0.5.1'),
  ).toBeNull()
  expect(existsSync(path)).toBe(true)
  expect(
    new LastVersionFile(directory, {
      writeFile: writeFailure,
    }).recordCurrentVersion('0.5.2'),
  ).toBeNull()
})
