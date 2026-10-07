import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
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
})
