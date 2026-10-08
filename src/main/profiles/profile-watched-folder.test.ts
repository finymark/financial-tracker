import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, test, vi } from 'vitest'
import type {
  WatchedFolderFileSystem,
  WatchedFolderTimers,
} from '../watched-folder-intake'
import { ProfileController } from './profile-controller'
import { ProfileRegistry } from './profile-registry'

const temporaryDirectories: string[] = []
const controllers: ProfileController[] = []

class FakeTimers implements WatchedFolderTimers {
  now = Date.parse('2026-01-15T10:00:00.000Z')
  #nextId = 1
  readonly #scheduled = new Map<
    number,
    { handler: () => void; at: number; interval: number | null }
  >()

  setInterval(handler: () => void, delay: number): number {
    return this.#schedule(handler, delay, delay)
  }

  clearInterval(id: unknown): void {
    this.#scheduled.delete(id as number)
  }

  setTimeout(handler: () => void, delay: number): number {
    return this.#schedule(handler, delay, null)
  }

  clearTimeout(id: unknown): void {
    this.#scheduled.delete(id as number)
  }

  async advance(delay: number): Promise<void> {
    const target = this.now + delay
    while (true) {
      const next = [...this.#scheduled.entries()]
        .filter(([, scheduled]) => scheduled.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0]
      if (!next) break
      const [id, scheduled] = next
      this.now = scheduled.at
      if (scheduled.interval === null) this.#scheduled.delete(id)
      else scheduled.at += scheduled.interval
      scheduled.handler()
      await Promise.resolve()
    }
    this.now = target
    await Promise.resolve()
  }

  #schedule(
    handler: () => void,
    delay: number,
    interval: number | null,
  ): number {
    const id = this.#nextId
    this.#nextId += 1
    this.#scheduled.set(id, { handler, at: this.now + delay, interval })
    return id
  }
}

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function controlledWatch() {
  const listeners = new Map<string, () => void>()
  const staleListeners = new Map<string, () => void>()
  const closed: string[] = []
  const watch: WatchedFolderFileSystem['watch'] = (path, listener) => {
    listeners.set(path, listener)
    staleListeners.set(path, listener)
    return {
      close() {
        closed.push(path)
        listeners.delete(path)
      },
    }
  }
  return {
    watch,
    closed,
    trigger(path: string) {
      listeners.get(path)?.()
    },
    triggerStale(path: string) {
      staleListeners.get(path)?.()
    },
  }
}

async function imageBytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer()
}

function setup(watch: WatchedFolderFileSystem['watch'], timers: FakeTimers) {
  const userDataDirectory = temporaryDirectory(
    'financial-tracker-profile-watched-',
  )
  const clock = () => new Date('2026-01-15T10:00:00.000Z')
  const controller = new ProfileController(
    new ProfileRegistry({ userDataDirectory, clock }),
    'en',
    {
      clock,
      watchedFolderOptions: {
        clock: () => timers.now,
        timers,
        fileSystem: { watch },
      },
    },
  )
  controllers.push(controller)
  return controller
}

afterEach(async () => {
  await Promise.all(
    controllers.splice(0).map((controller) => controller.close()),
  )
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('changing the setting stops the old folder and starts intake from the new folder', async () => {
  const watched = controlledWatch()
  const timers = new FakeTimers()
  const controller = setup(watched.watch, timers)
  const profile = await controller.create('Restart watcher')
  await controller.open(profile.id)
  const firstFolder = temporaryDirectory('financial-tracker-watched-first-')
  const secondFolder = temporaryDirectory('financial-tracker-watched-second-')

  await controller.updateSettings({
    id: profile.id,
    settings: { watchedFolder: firstFolder },
  })
  expect(controller.getWatchedFolderStatus()).toBe('watching')
  const firstPath = join(firstFolder, 'first.png')
  writeFileSync(firstPath, await imageBytes())
  watched.trigger(firstFolder)
  await timers.advance(2_000)
  await vi.waitFor(() =>
    expect(
      controller.getActiveApplication().queries.listReceipts(),
    ).toHaveLength(1),
  )

  await controller.updateSettings({
    id: profile.id,
    settings: { watchedFolder: secondFolder },
  })
  expect(controller.getWatchedFolderStatus()).toBe('watching')
  expect(watched.closed).toContain(firstFolder)
  const ignoredPath = join(firstFolder, 'ignored.jpg')
  const secondPath = join(secondFolder, 'second.webp')
  writeFileSync(ignoredPath, await imageBytes())
  writeFileSync(secondPath, await imageBytes())
  watched.triggerStale(firstFolder)
  watched.trigger(secondFolder)
  await timers.advance(2_000)
  await vi.waitFor(() =>
    expect(
      controller
        .getActiveApplication()
        .queries.listReceipts()
        .map((receipt) => receipt.originalFileName),
    ).toEqual(['first.png', 'second.png']),
  )
  expect(existsSync(ignoredPath)).toBe(true)
})

test('switching profiles stops the old folder before the new profile watches its folder', async () => {
  const watched = controlledWatch()
  const timers = new FakeTimers()
  const controller = setup(watched.watch, timers)
  const first = await controller.create('First watched profile')
  const second = await controller.create('Second watched profile')
  const firstFolder = temporaryDirectory('financial-tracker-switch-first-')
  const secondFolder = temporaryDirectory('financial-tracker-switch-second-')

  await controller.open(first.id)
  await controller.updateSettings({
    id: first.id,
    settings: { watchedFolder: firstFolder },
  })
  await controller.open(second.id)
  expect(watched.closed).toContain(firstFolder)
  expect(controller.getWatchedFolderStatus()).toBeNull()
  await controller.updateSettings({
    id: second.id,
    settings: { watchedFolder: secondFolder },
  })
  expect(controller.getWatchedFolderStatus()).toBe('watching')

  const oldPath = join(firstFolder, 'old-profile.png')
  const activePath = join(secondFolder, 'active-profile.png')
  const bytes = await imageBytes()
  writeFileSync(oldPath, bytes)
  writeFileSync(activePath, bytes)
  watched.triggerStale(firstFolder)
  watched.trigger(secondFolder)
  await timers.advance(2_000)
  await vi.waitFor(() =>
    expect(
      controller.getActiveApplication().queries.listReceipts(),
    ).toHaveLength(1),
  )

  expect(existsSync(oldPath)).toBe(true)
  expect(
    controller.getActiveApplication().queries.listReceipts()[0],
  ).toMatchObject({ originalFileName: 'active-profile.png', source: 'folder' })
})

test('rejects a watched folder equal to or inside application user data', async () => {
  const watched = controlledWatch()
  const timers = new FakeTimers()
  const userDataDirectory = temporaryDirectory(
    'financial-tracker-watched-user-data-',
  )
  const clock = () => new Date('2026-01-15T10:00:00.000Z')
  const controller = new ProfileController(
    new ProfileRegistry({ userDataDirectory, clock }),
    'en',
    {
      clock,
      watchedFolderOptions: {
        clock: () => timers.now,
        timers,
        fileSystem: { watch: watched.watch },
      },
    },
  )
  controllers.push(controller)
  const profile = await controller.create('Safe watched folder')
  await controller.open(profile.id)
  const nested = join(userDataDirectory, 'nested')
  mkdirSync(nested)

  expect(() =>
    controller.updateSettings({
      id: profile.id,
      settings: { watchedFolder: userDataDirectory },
    }),
  ).toThrow('watchedFolder.error.userData')
  expect(() =>
    controller.updateSettings({
      id: profile.id,
      settings: { watchedFolder: nested },
    }),
  ).toThrow('watchedFolder.error.userData')

  const outside = temporaryDirectory('financial-tracker-watched-safe-')
  await expect(
    controller.updateSettings({
      id: profile.id,
      settings: { watchedFolder: outside },
    }),
  ).resolves.toMatchObject({ watchedFolder: outside })
})
