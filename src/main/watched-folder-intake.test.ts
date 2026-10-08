import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  WatchedFolderIntake,
  type ReceiptIntake,
  type WatchedFolderFileSystem,
  type WatchedFolderIntakeOptions,
} from './watched-folder-intake'

const temporaryDirectories: string[] = []
const activeWatchers: WatchedFolderIntake[] = []

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-watched-'))
  temporaryDirectories.push(directory)
  return directory
}

function controlledWatch() {
  let changed: (() => void) | undefined
  const close = vi.fn()
  const watch: WatchedFolderFileSystem['watch'] = (_path, listener) => {
    changed = listener
    return { close }
  }
  return { watch, close, changed: () => changed?.() }
}

function createWatcher(
  intake: ReceiptIntake,
  options: WatchedFolderIntakeOptions = {},
): WatchedFolderIntake {
  const watcher = new WatchedFolderIntake(intake, options)
  activeWatchers.push(watcher)
  return watcher
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
})

afterEach(async () => {
  await Promise.all(activeWatchers.splice(0).map((watcher) => watcher.stop()))
  vi.useRealTimers()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('picks up a complete image found at start and a new image while running', async () => {
  const folder = temporaryDirectory()
  writeFileSync(join(folder, 'closed-app.JPG'), 'first')
  const watched = controlledWatch()
  const intake = vi.fn(async () => undefined)
  const watcher = createWatcher(intake, {
    fileSystem: { watch: watched.watch },
    clock: () => Date.now(),
  })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(1_999)
  expect(intake).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(intake).toHaveBeenCalledWith(
    { path: join(folder, 'feldolgozott', 'closed-app.JPG') },
    'folder',
  )

  writeFileSync(join(folder, 'running.png'), 'second')
  watched.changed()
  await vi.advanceTimersByTimeAsync(2_000)
  expect(intake).toHaveBeenLastCalledWith(
    { path: join(folder, 'feldolgozott', 'running.png') },
    'folder',
  )
  expect(intake).toHaveBeenCalledTimes(2)
})

test('waits for size and mtime to remain stable for two seconds', async () => {
  const folder = temporaryDirectory()
  const path = join(folder, 'syncing.webp')
  writeFileSync(path, 'part')
  const intake = vi.fn(async () => undefined)
  const watcher = createWatcher(intake, { clock: () => Date.now() })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(1_000)
  writeFileSync(path, 'a larger second part')
  await vi.advanceTimersByTimeAsync(1_000)
  expect(intake).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(999)
  expect(intake).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(intake).toHaveBeenCalledTimes(1)
})

test('retries an image when rename reports that it is still in use', async () => {
  const folder = temporaryDirectory()
  const source = join(folder, 'locked.jpeg')
  writeFileSync(source, 'image')
  const watched = controlledWatch()
  let locked = true
  const rename: WatchedFolderFileSystem['rename'] = (from, to) => {
    if (from === source && locked) {
      const error = new Error('in use') as NodeJS.ErrnoException
      error.code = 'EBUSY'
      throw error
    }
    renameSync(from, to)
  }
  const intake = vi.fn(async () => undefined)
  const watcher = createWatcher(intake, {
    fileSystem: { watch: watched.watch, rename },
    clock: () => Date.now(),
  })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(2_000)
  expect(intake).not.toHaveBeenCalled()
  expect(existsSync(source)).toBe(true)

  locked = false
  watched.changed()
  await vi.advanceTimersByTimeAsync(0)
  expect(intake).toHaveBeenCalledTimes(1)
  expect(existsSync(source)).toBe(false)
})

test('ignores non-images, temporary names, and files already in feldolgozott', async () => {
  const folder = temporaryDirectory()
  const processed = join(folder, 'feldolgozott')
  mkdirSync(processed)
  for (const name of [
    'notes.txt',
    '.hidden.jpg',
    '~$upload.png',
    'receipt.tmp.jpg',
    'receipt.partial.webp',
    'receipt.crdownload.jpeg',
  ]) {
    writeFileSync(join(folder, name), 'ignored')
  }
  writeFileSync(join(processed, 'already.png'), 'ignored')
  const intake = vi.fn(async () => undefined)
  const watcher = createWatcher(intake, { clock: () => Date.now() })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(32_000)
  expect(intake).not.toHaveBeenCalled()
})

test('preserves both files when the processed name collides', async () => {
  const folder = temporaryDirectory()
  const processed = join(folder, 'feldolgozott')
  mkdirSync(processed)
  writeFileSync(join(processed, 'photo.jpg'), 'old')
  writeFileSync(join(folder, 'photo.jpg'), 'new')
  const intake = vi.fn(async () => undefined)
  const watcher = createWatcher(intake, { clock: () => Date.now() })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(2_000)
  expect(intake).toHaveBeenCalledWith(
    { path: join(processed, 'photo (2).jpg') },
    'folder',
  )
  expect(existsSync(join(processed, 'photo.jpg'))).toBe(true)
  expect(existsSync(join(processed, 'photo (2).jpg'))).toBe(true)
})

test('keeps a moved image and reports its name and reason when intake rejects', async () => {
  const folder = temporaryDirectory()
  writeFileSync(join(folder, 'unreadable.png'), 'image')
  const onFailure = vi.fn()
  const intake = vi.fn(async () => {
    throw new Error('receiptInbox.error.invalidImage')
  })
  const watcher = createWatcher(intake, {
    clock: () => Date.now(),
    onFailure,
  })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(2_000)
  const moved = join(folder, 'feldolgozott', 'unreadable.png')
  expect(existsSync(moved)).toBe(true)
  expect(onFailure).toHaveBeenCalledWith({
    fileName: basename(moved),
    reasonKey: 'receiptInbox.error.invalidImage',
  })
})

test('runs only one intake at a time', async () => {
  const folder = temporaryDirectory()
  writeFileSync(join(folder, 'first.jpg'), 'first')
  writeFileSync(join(folder, 'second.jpg'), 'second')
  let releaseFirst: (() => void) | undefined
  const firstPending = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const intake = vi
    .fn<ReceiptIntake>()
    .mockImplementationOnce(() => firstPending)
    .mockResolvedValue(undefined)
  const watcher = createWatcher(intake, { clock: () => Date.now() })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(2_000)
  expect(intake).toHaveBeenCalledTimes(1)
  releaseFirst!()
  await firstPending
  await vi.advanceTimersByTimeAsync(0)
  expect(intake).toHaveBeenCalledTimes(2)
})

test('stop waits for the current intake and prevents the next ready image', async () => {
  const folder = temporaryDirectory()
  writeFileSync(join(folder, 'first.jpg'), 'first')
  writeFileSync(join(folder, 'second.jpg'), 'second')
  let releaseFirst: (() => void) | undefined
  const firstPending = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const intake = vi.fn<ReceiptIntake>().mockReturnValue(firstPending)
  const watcher = createWatcher(intake, { clock: () => Date.now() })

  await watcher.start(folder)
  await vi.advanceTimersByTimeAsync(2_000)
  expect(intake).toHaveBeenCalledTimes(1)
  const stopped = watcher.stop()
  releaseFirst!()
  await stopped
  expect(intake).toHaveBeenCalledTimes(1)
})

test('reports an unavailable folder, retries it every 30 seconds, and stops pickups', async () => {
  const parent = temporaryDirectory()
  const folder = join(parent, 'later')
  const statuses: string[] = []
  const intake = vi.fn(async () => undefined)
  const watcher = createWatcher(intake, {
    clock: () => Date.now(),
    onStatusChanged: (status) => statuses.push(status),
  })

  await watcher.start(folder)
  expect(statuses).toEqual(['unavailable'])
  mkdirSync(folder)
  writeFileSync(join(folder, 'later.png'), 'image')
  await vi.advanceTimersByTimeAsync(30_000)
  expect(statuses).toEqual(['unavailable', 'watching'])
  await vi.advanceTimersByTimeAsync(2_000)
  expect(intake).toHaveBeenCalledTimes(1)

  await watcher.stop()
  writeFileSync(join(folder, 'after-stop.jpg'), 'image')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(intake).toHaveBeenCalledTimes(1)
})
