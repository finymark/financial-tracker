import {
  existsSync,
  mkdirSync,
  readdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { openProfileApplication } from './profile-application'
import { ProfileRegistry } from './profile-registry'

const temporaryDirectories: string[] = []

function temporaryUserData(): string {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-registry-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('profile registry', () => {
  test('retries a transient lock when first creating the registry', () => {
    const userData = temporaryUserData()
    const lock = Object.assign(new Error('Synthetic lock'), { code: 'EPERM' })
    const rename = vi
      .fn<typeof renameSync>()
      .mockImplementationOnce(() => {
        throw lock
      })
      .mockImplementation(renameSync)
    const wait = vi.fn()

    const registry = new ProfileRegistry({
      userDataDirectory: userData,
      rename,
      wait,
    })

    expect(registry.listProfiles()).toEqual([])
    expect(rename).toHaveBeenCalledTimes(2)
    expect(wait.mock.calls).toEqual([[10]])
    expect(existsSync(join(userData, 'profiles.json.tmp'))).toBe(false)
  })

  test.each(['EPERM', 'EACCES', 'EBUSY'])(
    'retries %s without changing the original until atomic replacement succeeds',
    (code) => {
      const userData = temporaryUserData()
      const rename = vi.fn(renameSync)
      const wait = vi.fn()
      const registry = new ProfileRegistry({
        userDataDirectory: userData,
        rename,
        wait,
      })
      const first = registry.createProfile('First profile')
      registry.rememberLastUsed(first.id)
      const registryPath = join(userData, 'profiles.json')
      const original = readFileSync(registryPath, 'utf8')
      const lock = Object.assign(new Error('Synthetic lock'), { code })
      rename.mockClear()
      wait.mockClear()
      rename
        .mockImplementationOnce(() => {
          throw lock
        })
        .mockImplementationOnce(() => {
          throw lock
        })
      wait.mockImplementation(() => {
        expect(readFileSync(registryPath, 'utf8')).toBe(original)
        expect(
          JSON.parse(readFileSync(`${registryPath}.tmp`, 'utf8')).profiles[0]
            .name,
        ).toBe('Renamed profile')
      })

      const renamed = registry.renameProfile(first.id, 'Renamed profile')

      expect(rename.mock.calls).toEqual(
        Array(3).fill([`${registryPath}.tmp`, registryPath]),
      )
      expect(wait.mock.calls).toEqual([[10], [20]])
      expect(registry.listProfiles()).toEqual([renamed])
      const reopened = new ProfileRegistry({ userDataDirectory: userData })
      expect(reopened.listProfiles()).toEqual([renamed])
      expect(reopened.getLastUsedProfileId()).toBe(first.id)
      expect(existsSync(`${registryPath}.tmp`)).toBe(false)
    },
  )

  test.each(['EPERM', 'EACCES', 'EBUSY'])(
    'bounds retries for persistent %s and rolls back failed profile creation',
    (code) => {
      const userData = temporaryUserData()
      const rename = vi.fn(renameSync)
      const wait = vi.fn()
      const id = '00000000-0000-4000-8000-000000000001'
      const registry = new ProfileRegistry({
        userDataDirectory: userData,
        createId: () => id,
        rename,
        wait,
      })
      const registryPath = join(userData, 'profiles.json')
      const original = readFileSync(registryPath, 'utf8')
      const lock = Object.assign(new Error('Synthetic lock'), { code })
      rename.mockClear()
      rename.mockImplementation(() => {
        throw lock
      })

      expect(() => registry.createProfile('Failed profile')).toThrow(
        'profiles.error.registryWrite',
      )

      expect(rename).toHaveBeenCalledTimes(6)
      expect(wait.mock.calls).toEqual([[10], [20], [40], [80], [160]])
      expect(readFileSync(registryPath, 'utf8')).toBe(original)
      expect(registry.listProfiles()).toEqual([])
      expect(existsSync(registry.getProfilePaths(id).profileDirectory)).toBe(
        false,
      )
      expect(existsSync(`${registryPath}.tmp`)).toBe(false)
    },
  )

  test.each(['EIO', 'ENOENT'])(
    'propagates non-transient %s without retrying',
    (code) => {
      const userData = temporaryUserData()
      const registryPath = join(userData, 'profiles.json')
      const rename = vi.fn(renameSync)
      const wait = vi.fn()
      const registry = new ProfileRegistry({
        userDataDirectory: userData,
        rename,
        wait,
      })
      const original = readFileSync(registryPath, 'utf8')
      const failure = Object.assign(new Error('Synthetic failure'), { code })
      rename.mockClear()
      rename.mockImplementation(() => {
        throw failure
      })

      expect(() => registry.createProfile('Failed profile')).toThrow(
        'profiles.error.registryWrite',
      )

      expect(rename).toHaveBeenCalledTimes(1)
      expect(wait).not.toHaveBeenCalled()
      expect(readFileSync(registryPath, 'utf8')).toBe(original)
      expect(existsSync(`${registryPath}.tmp`)).toBe(false)
    },
  )

  test('lists profiles and remembers the last profile used', () => {
    const userData = temporaryUserData()
    const registry = new ProfileRegistry({
      userDataDirectory: userData,
      clock: () => new Date('2026-01-15T10:00:00.000Z'),
    })

    const first = registry.createProfile('First profile')
    const second = registry.createProfile('Second profile')
    registry.rememberLastUsed(first.id)

    const reopened = new ProfileRegistry({ userDataDirectory: userData })
    expect(reopened.listProfiles()).toEqual([first, second])
    expect(reopened.getLastUsedProfileId()).toBe(first.id)
  })

  test('renames and safely deletes a profile database and its whole folder', async () => {
    const userData = temporaryUserData()
    const registry = new ProfileRegistry({ userDataDirectory: userData })
    const profile = registry.createProfile('Old name')
    const paths = registry.getProfilePaths(profile.id)
    const application = await openProfileApplication({ profile, paths })
    application.close()

    expect(existsSync(paths.dataDirectory)).toBe(true)
    expect(existsSync(paths.databasePath)).toBe(true)
    const renamed = registry.renameProfile(profile.id, 'New name')
    expect(renamed.name).toBe('New name')
    expect(() => registry.deleteProfile(profile.id, 'Old name')).toThrow(
      'confirmation',
    )

    registry.deleteProfile(profile.id, 'New name')

    expect(registry.listProfiles()).toEqual([])
    expect(existsSync(paths.profileDirectory)).toBe(false)
  })

  test('keeps the registry and profile directory when tombstoning fails', () => {
    const userData = temporaryUserData()
    const failure = new Error('Synthetic directory lock')
    const renameProfileDirectory = vi.fn(() => {
      throw failure
    })
    const registry = new ProfileRegistry({
      userDataDirectory: userData,
      renameProfileDirectory,
    })
    const profile = registry.createProfile('Kept profile')

    expect(() => registry.deleteProfile(profile.id, profile.name)).toThrow(
      'profiles.error.delete',
    )
    expect(registry.listProfiles()).toEqual([profile])
    expect(
      existsSync(registry.getProfilePaths(profile.id).profileDirectory),
    ).toBe(true)
  })

  test('restores the profile directory when removing it from the registry fails', () => {
    const userData = temporaryUserData()
    const rename = vi.fn(renameSync)
    const registry = new ProfileRegistry({
      userDataDirectory: userData,
      rename,
    })
    const profile = registry.createProfile('Rollback profile')
    const paths = registry.getProfilePaths(profile.id)
    rename.mockImplementation(() => {
      throw Object.assign(new Error('Synthetic registry lock'), { code: 'EIO' })
    })

    expect(() => registry.deleteProfile(profile.id, profile.name)).toThrow(
      'profiles.error.delete',
    )
    expect(registry.listProfiles()).toEqual([profile])
    expect(existsSync(paths.profileDirectory)).toBe(true)
  })

  test('commits deletion before best-effort tombstone cleanup and removes stale tombstones on startup', () => {
    const userData = temporaryUserData()
    const remove = vi.fn<typeof rmSync>(() => {
      throw new Error('Synthetic cleanup lock')
    })
    const registry = new ProfileRegistry({
      userDataDirectory: userData,
      remove,
    })
    const profile = registry.createProfile('Deleted profile')
    registry.deleteProfile(profile.id, profile.name)
    expect(registry.listProfiles()).toEqual([])
    expect(
      existsSync(registry.getProfilePaths(profile.id).profileDirectory),
    ).toBe(false)
    const profilesDirectory = join(userData, 'profiles')
    expect(readFileSync(join(userData, 'profiles.json'), 'utf8')).not.toContain(
      profile.id,
    )
    // A normal startup retries any tombstone left by the failed best-effort remove.
    new ProfileRegistry({ userDataDirectory: userData })
    expect(
      readdirSync(profilesDirectory).some((name) =>
        name.startsWith('.deleted-'),
      ),
    ).toBe(false)
  })

  test('cleans a stale tombstone directory on startup', () => {
    const userData = temporaryUserData()
    const tombstone = join(userData, 'profiles', '.deleted-stale')
    mkdirSync(tombstone, { recursive: true })
    new ProfileRegistry({ userDataDirectory: userData })
    expect(existsSync(tombstone)).toBe(false)
  })
})
