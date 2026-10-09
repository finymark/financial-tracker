import {
  existsSync,
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
import { parseAutostartInput, parseShortcutInput } from './desktop-ipc'
import { DEFAULT_QUICK_ADD_ACCELERATOR } from '../shared/accelerator'

const directories: string[] = []
function temporaryUserData() {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-app-settings-'),
  )
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('notice is app-level, defaults to unseen, and persists across reopening', () => {
  const directory = temporaryUserData()
  const settings = new AppSettingsFile(directory)
  expect(settings.isTrayNoticeShown()).toBe(false)
  expect(settings.getQuickAddAccelerator()).toBe(DEFAULT_QUICK_ADD_ACCELERATOR)
  settings.markTrayNoticeShown()
  settings.setQuickAddAccelerator('Control+Shift+K')
  expect(new AppSettingsFile(directory).isTrayNoticeShown()).toBe(true)
  expect(new AppSettingsFile(directory).getQuickAddAccelerator()).toBe(
    'Control+Shift+K',
  )
  expect(
    JSON.parse(readFileSync(join(directory, 'app-settings.json'), 'utf8')),
  ).toEqual({
    version: 1,
    trayNoticeShown: true,
    quickAddAccelerator: 'Control+Shift+K',
  })
  expect(existsSync(join(directory, 'app-settings.json.tmp'))).toBe(false)
})

test.each([
  'not JSON',
  'null',
  '[]',
  '{}',
  '{"version":2,"trayNoticeShown":true}',
  '{"version":1,"trayNoticeShown":"true"}',
  '{"version":1,"trayNoticeShown":0}',
  '{"version":1,"trayNoticeShown":true,"quickAddAccelerator":"N"}',
  '{"version":1,"trayNoticeShown":true,"quickAddAccelerator":42}',
  '{"version":1,"trayNoticeShown":true,"profileId":"unexpected"}',
])(
  'rejects invalid stored settings without overwriting them: %s',
  (contents) => {
    const directory = temporaryUserData()
    const path = join(directory, 'app-settings.json')
    writeFileSync(path, contents)
    expect(() => new AppSettingsFile(directory)).toThrow()
    expect(readFileSync(path, 'utf8')).toBe(contents)
  },
)

test('loads the pre-shortcut app settings shape with the default accelerator', () => {
  const directory = temporaryUserData()
  writeFileSync(
    join(directory, 'app-settings.json'),
    '{"version":1,"trayNoticeShown":true}',
  )
  const settings = new AppSettingsFile(directory)
  expect(settings.isTrayNoticeShown()).toBe(true)
  expect(settings.getQuickAddAccelerator()).toBe(DEFAULT_QUICK_ADD_ACCELERATOR)
  expect(settings.getWindowState()).toBeUndefined()
})

test('ignores a stale temporary file; never treats it as saved settings', () => {
  const directory = temporaryUserData()
  new AppSettingsFile(directory)
  writeFileSync(
    join(directory, 'app-settings.json.tmp'),
    '{"version":1,"trayNoticeShown":true}',
  )
  expect(new AppSettingsFile(directory).isTrayNoticeShown()).toBe(false)
})

test.each(['EPERM', 'EACCES', 'EBUSY'])(
  'retries %s atomic replacement with the original intact',
  (code) => {
    const directory = temporaryUserData()
    const rename = vi.fn(renameSync)
    const wait = vi.fn()
    const settings = new AppSettingsFile(directory, { rename, wait })
    const path = join(directory, 'app-settings.json')
    const original = readFileSync(path, 'utf8')
    rename.mockClear()
    rename.mockImplementationOnce(() => {
      throw Object.assign(new Error('Synthetic lock'), { code })
    })
    wait.mockImplementation(() => {
      expect(readFileSync(path, 'utf8')).toBe(original)
    })
    settings.markTrayNoticeShown()
    expect(rename).toHaveBeenCalledTimes(2)
    expect(wait.mock.calls).toEqual([[10]])
    expect(new AppSettingsFile(directory).isTrayNoticeShown()).toBe(true)
    expect(existsSync(`${path}.tmp`)).toBe(false)
  },
)

test.each(['EBUSY', 'EIO'])(
  'failed %s replacement keeps the previous value and cleans the temporary file',
  (code) => {
    const directory = temporaryUserData()
    const rename = vi.fn(renameSync)
    const wait = vi.fn()
    const settings = new AppSettingsFile(directory, { rename, wait })
    rename.mockClear()
    rename.mockImplementation(() => {
      throw Object.assign(new Error('Synthetic failure'), { code })
    })
    expect(() => settings.markTrayNoticeShown()).toThrow('Synthetic failure')
    expect(rename).toHaveBeenCalledTimes(code === 'EBUSY' ? 6 : 1)
    expect(wait.mock.calls).toEqual(
      code === 'EBUSY' ? [[10], [20], [40], [80], [160]] : [],
    )
    expect(new AppSettingsFile(directory).isTrayNoticeShown()).toBe(false)
    expect(existsSync(join(directory, 'app-settings.json.tmp'))).toBe(false)
  },
)

test.each([true, false])(
  'autostart IPC accepts a boolean %s',
  (openAtLogin) => {
    expect(parseAutostartInput({ openAtLogin })).toEqual({ openAtLogin })
  },
)

test.each([
  null,
  [],
  {},
  true,
  { openAtLogin: 'true' },
  { openAtLogin: 1 },
  { openAtLogin: true, profileId: 'unexpected' },
])('rejects malformed autostart IPC input: %j', (value) => {
  expect(() => parseAutostartInput(value)).toThrow()
})

test('normalises a valid shortcut IPC input', () => {
  expect(parseShortcutInput({ accelerator: 'Ctrl+Shift+k' })).toEqual({
    accelerator: 'Control+Shift+K',
  })
})

test.each([
  null,
  {},
  { accelerator: 1 },
  { accelerator: 'N' },
  { accelerator: 'Control+N', extra: true },
])('rejects malformed shortcut IPC input: %j', (value) => {
  expect(() => parseShortcutInput(value)).toThrow()
})

test('window state defaults to absent and persists installation-wide alongside existing settings', () => {
  const directory = temporaryUserData()
  const settings = new AppSettingsFile(directory)
  expect(settings.getWindowState()).toBeUndefined()
  const state = {
    bounds: { x: -1100, y: 60, width: 1000, height: 700 },
    maximized: true,
  }
  settings.setWindowState(state)
  settings.markTrayNoticeShown()
  settings.setQuickAddAccelerator('Control+Shift+K')
  const reopened = new AppSettingsFile(directory)
  expect(reopened.getWindowState()).toEqual(state)
  expect(reopened.isTrayNoticeShown()).toBe(true)
  expect(reopened.getQuickAddAccelerator()).toBe('Control+Shift+K')
  expect(existsSync(join(directory, 'app-settings.json.tmp'))).toBe(false)
})

test.each(
  [
    null,
    [],
    {},
    { bounds: { x: 0, y: 0, width: 0, height: 600 }, maximized: true },
    { bounds: { x: 0, y: '0', width: 900, height: 600 }, maximized: false },
    { bounds: { x: 0, y: 0, width: 900, height: 600 }, maximized: 'true' },
    {
      bounds: { x: 0, y: 0, width: 900, height: 600, extra: true },
      maximized: true,
    },
    {
      bounds: { x: 0, y: 0, width: 900, height: 600 },
      maximized: true,
      fullscreen: true,
    },
  ].map((value) => [value]),
)(
  'ignores only an invalid stored window state without losing other installation settings: %j',
  (windowState) => {
    const directory = temporaryUserData()
    const contents = JSON.stringify({
      version: 1,
      trayNoticeShown: true,
      quickAddAccelerator: 'Control+Shift+K',
      windowState,
    })
    const path = join(directory, 'app-settings.json')
    writeFileSync(path, contents)
    const settings = new AppSettingsFile(directory)
    expect(settings.getWindowState()).toBeUndefined()
    expect(settings.isTrayNoticeShown()).toBe(true)
    expect(settings.getQuickAddAccelerator()).toBe('Control+Shift+K')
    expect(readFileSync(path, 'utf8')).toBe(contents)
    settings.setWindowState({
      bounds: { x: 0, y: 0, width: 900, height: 600 },
      maximized: false,
    })
    expect(new AppSettingsFile(directory).getWindowState()).toEqual({
      bounds: { x: 0, y: 0, width: 900, height: 600 },
      maximized: false,
    })
  },
)

test('rejects an invalid window-state write without changing the previous settings', () => {
  const directory = temporaryUserData()
  const settings = new AppSettingsFile(directory)
  const path = join(directory, 'app-settings.json')
  const original = readFileSync(path, 'utf8')
  expect(() =>
    settings.setWindowState({
      bounds: { x: 0, y: 0, width: 0, height: 600 },
      maximized: true,
    }),
  ).toThrow('Invalid window state')
  expect(readFileSync(path, 'utf8')).toBe(original)
  expect(existsSync(`${path}.tmp`)).toBe(false)
})

test('window-state updates use atomic retry and preserve the last saved state when replacement fails', () => {
  const directory = temporaryUserData()
  const rename = vi.fn(renameSync)
  const wait = vi.fn()
  const settings = new AppSettingsFile(directory, { rename, wait })
  const state = {
    bounds: { x: 40, y: 60, width: 1000, height: 700 },
    maximized: true,
  }
  rename.mockImplementationOnce(() => {
    throw Object.assign(new Error('Synthetic lock'), { code: 'EBUSY' })
  })
  settings.setWindowState(state)
  expect(wait.mock.calls).toEqual([[10]])
  expect(new AppSettingsFile(directory).getWindowState()).toEqual(state)
  const path = join(directory, 'app-settings.json')
  const original = readFileSync(path, 'utf8')
  rename.mockImplementation(() => {
    throw Object.assign(new Error('Synthetic failure'), { code: 'EIO' })
  })
  expect(() => settings.setWindowState({ ...state, maximized: false })).toThrow(
    'Synthetic failure',
  )
  expect(readFileSync(path, 'utf8')).toBe(original)
  expect(new AppSettingsFile(directory).getWindowState()).toEqual(state)
  expect(existsSync(`${path}.tmp`)).toBe(false)
})
