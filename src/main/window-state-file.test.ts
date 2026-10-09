import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { AppSettingsFile } from './app-settings'
import { WindowStateFile } from './window-state-file'

const directories: string[] = []
function temporaryUserData() {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-window-state-'),
  )
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

const state = {
  bounds: { x: -1100, y: 60, width: 1000, height: 700 },
  maximized: true,
}

test('persists installation-wide in a separate file without changing the older app-settings shape', () => {
  const directory = temporaryUserData()
  const settings = new AppSettingsFile(directory)
  settings.markTrayNoticeShown()
  const appSettingsPath = join(directory, 'app-settings.json')
  const original = readFileSync(appSettingsPath, 'utf8')
  const file = new WindowStateFile(directory)
  expect(file.getWindowState()).toBeUndefined()
  expect(existsSync(join(directory, 'window-state.json'))).toBe(false)
  file.setWindowState(state)
  expect(new WindowStateFile(directory).getWindowState()).toEqual(state)
  expect(
    JSON.parse(readFileSync(join(directory, 'window-state.json'), 'utf8')),
  ).toEqual(state)
  expect(readFileSync(appSettingsPath, 'utf8')).toBe(original)
  expect(new AppSettingsFile(directory).isTrayNoticeShown()).toBe(true)
  expect(existsSync(join(directory, 'window-state.json.tmp'))).toBe(false)
})

test.each([
  'not JSON',
  'null',
  '[]',
  '{}',
  '{"bounds":{"x":0,"y":0,"width":0,"height":600},"maximized":true}',
  '{"bounds":{"x":0,"y":0,"width":900,"height":600},"maximized":"true"}',
  '{"bounds":{"x":0,"y":0,"width":900,"height":600},"maximized":true,"extra":true}',
])('ignores corrupt or invalid state without rewriting it: %s', (contents) => {
  const directory = temporaryUserData()
  const path = join(directory, 'window-state.json')
  writeFileSync(path, contents)
  expect(new WindowStateFile(directory).getWindowState()).toBeUndefined()
  expect(readFileSync(path, 'utf8')).toBe(contents)
})

test('missing or unreadable state never prevents startup, and temporary files are never consumed', () => {
  const directory = temporaryUserData()
  const missing = join(directory, 'missing')
  expect(new WindowStateFile(missing).getWindowState()).toBeUndefined()
  expect(existsSync(missing)).toBe(false)
  writeFileSync(join(directory, 'window-state.json.tmp'), JSON.stringify(state))
  expect(new WindowStateFile(directory).getWindowState()).toBeUndefined()
  mkdirSync(join(directory, 'window-state.json'))
  expect(new WindowStateFile(directory).getWindowState()).toBeUndefined()
})

test('invalid writes leave the saved state intact', () => {
  const directory = temporaryUserData()
  const file = new WindowStateFile(directory)
  file.setWindowState(state)
  const path = join(directory, 'window-state.json')
  const original = readFileSync(path, 'utf8')
  expect(() =>
    file.setWindowState({ ...state, bounds: { ...state.bounds, width: 0 } }),
  ).toThrow('Invalid window state')
  expect(readFileSync(path, 'utf8')).toBe(original)
  expect(existsSync(`${path}.tmp`)).toBe(false)
})

test.each(['EPERM', 'EACCES', 'EBUSY'])(
  'retries %s atomic replacement while preserving the old state',
  (code) => {
    const directory = temporaryUserData()
    const rename = vi.fn(renameSync)
    const wait = vi.fn()
    const file = new WindowStateFile(directory, { rename, wait })
    file.setWindowState(state)
    const path = join(directory, 'window-state.json')
    const original = readFileSync(path, 'utf8')
    rename.mockClear()
    rename.mockImplementationOnce(() => {
      throw Object.assign(new Error('Synthetic lock'), { code })
    })
    wait.mockImplementation(() => {
      expect(readFileSync(path, 'utf8')).toBe(original)
    })
    file.setWindowState({ ...state, maximized: false })
    expect(rename).toHaveBeenCalledTimes(2)
    expect(wait.mock.calls).toEqual([[10]])
    expect(new WindowStateFile(directory).getWindowState()).toEqual({
      ...state,
      maximized: false,
    })
    expect(existsSync(`${path}.tmp`)).toBe(false)
  },
)

test.each(['EBUSY', 'EIO'])(
  'a failed %s replacement keeps the original and cleans the temporary file',
  (code) => {
    const directory = temporaryUserData()
    const rename = vi.fn(renameSync)
    const wait = vi.fn()
    const file = new WindowStateFile(directory, { rename, wait })
    file.setWindowState(state)
    const path = join(directory, 'window-state.json')
    const original = readFileSync(path, 'utf8')
    rename.mockClear()
    rename.mockImplementation(() => {
      throw Object.assign(new Error('Synthetic failure'), { code })
    })
    expect(() => file.setWindowState({ ...state, maximized: false })).toThrow(
      'Synthetic failure',
    )
    expect(rename).toHaveBeenCalledTimes(code === 'EBUSY' ? 6 : 1)
    expect(wait.mock.calls).toEqual(
      code === 'EBUSY' ? [[10], [20], [40], [80], [160]] : [],
    )
    expect(readFileSync(path, 'utf8')).toBe(original)
    expect(new WindowStateFile(directory).getWindowState()).toEqual(state)
    expect(existsSync(`${path}.tmp`)).toBe(false)
  },
)
