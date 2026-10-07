import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  CURRENT_MIGRATIONS,
  openProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'
import type { ProfileSettingsChanges } from '../../shared/settings'

const temporaryDirectories: string[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

function setup() {
  const userDataDirectory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-settings-'),
  )
  temporaryDirectories.push(userDataDirectory)
  return new ProfileRegistry({ userDataDirectory, clock })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a new profile starts with English, the system theme and HUF base currency', async () => {
  const registry = setup()
  const profile = registry.createProfile('Default settings')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  try {
    expect(application.queries.getSettings()).toEqual({
      language: 'en',
      theme: 'system',
      baseCurrency: 'HUF',
    })
  } finally {
    application.close()
  }
})

test('setting changes apply immediately and survive closing and reopening the profile', async () => {
  const registry = setup()
  const profile = registry.createProfile('Saved settings')
  const options = {
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  }
  const application = await openProfileApplication(options)
  try {
    expect(
      application.commands.updateSettings({
        language: 'hu',
        theme: 'dark',
        baseCurrency: 'CHF',
      }),
    ).toEqual({
      language: 'hu',
      theme: 'dark',
      baseCurrency: 'CHF',
    })
    expect(application.queries.getSettings()).toEqual({
      language: 'hu',
      theme: 'dark',
      baseCurrency: 'CHF',
    })
  } finally {
    application.close()
  }
  const reopened = await openProfileApplication(options)
  try {
    expect(reopened.queries.getSettings()).toEqual({
      language: 'hu',
      theme: 'dark',
      baseCurrency: 'CHF',
    })
  } finally {
    reopened.close()
  }
})

test.each(
  [
    null,
    undefined,
    [],
    'dark',
    { language: 'fr' },
    { theme: 'automatic' },
    { baseCurrency: 'EUR' },
    { language: 'de', theme: null },
    { baseCurrency: undefined },
    { unexpected: 'value' },
  ].map((input) => ({ input })),
)(
  'invalid settings are rejected without changing saved settings: $input',
  async ({ input }) => {
    const registry = setup()
    const profile = registry.createProfile('Validated settings')
    const application = await openProfileApplication({
      profile,
      paths: registry.getProfilePaths(profile.id),
      clock,
    })
    try {
      application.commands.updateSettings({
        language: 'hu',
        theme: 'dark',
        baseCurrency: 'CHF',
      })
      expect(() =>
        application.commands.updateSettings(input as ProfileSettingsChanges),
      ).toThrow()
      expect(application.queries.getSettings()).toEqual({
        language: 'hu',
        theme: 'dark',
        baseCurrency: 'CHF',
      })
    } finally {
      application.close()
    }
  },
)

test('switching between reopened profiles restores only their own settings', async () => {
  const registry = setup()
  const first = registry.createProfile('First')
  const second = registry.createProfile('Second')
  const firstOptions = {
    profile: first,
    paths: registry.getProfilePaths(first.id),
    clock,
  }
  const secondOptions = {
    profile: second,
    paths: registry.getProfilePaths(second.id),
    clock,
  }
  const firstApplication = await openProfileApplication(firstOptions)
  try {
    firstApplication.commands.updateSettings({
      language: 'de',
      theme: 'light',
      baseCurrency: 'CHF',
    })
  } finally {
    firstApplication.close()
  }
  const secondApplication = await openProfileApplication(secondOptions)
  try {
    expect(secondApplication.queries.getSettings()).toEqual({
      language: 'en',
      theme: 'system',
      baseCurrency: 'HUF',
    })
    secondApplication.commands.updateSettings({ language: 'hu', theme: 'dark' })
  } finally {
    secondApplication.close()
  }
  for (const [options, expected] of [
    [firstOptions, { language: 'de', theme: 'light', baseCurrency: 'CHF' }],
    [secondOptions, { language: 'hu', theme: 'dark', baseCurrency: 'HUF' }],
  ] as const) {
    const reopened = await openProfileApplication(options)
    try {
      expect(reopened.queries.getSettings()).toEqual(expected)
    } finally {
      reopened.close()
    }
  }
})

test('changing one setting preserves the other saved choices', async () => {
  const registry = setup()
  const profile = registry.createProfile('Independent settings')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  try {
    application.commands.updateSettings({
      language: 'hu',
      theme: 'dark',
      baseCurrency: 'CHF',
    })
    expect(application.commands.updateSettings({ language: 'de' })).toEqual({
      language: 'de',
      theme: 'dark',
      baseCurrency: 'CHF',
    })
    expect(application.commands.updateSettings({ theme: 'light' })).toEqual({
      language: 'de',
      theme: 'light',
      baseCurrency: 'CHF',
    })
    expect(
      application.commands.updateSettings({
        language: 'en',
        theme: 'system',
        baseCurrency: 'HUF',
      }),
    ).toEqual({ language: 'en', theme: 'system', baseCurrency: 'HUF' })
  } finally {
    application.close()
  }
})

test('an existing profile gains default settings when upgraded from the identity-only schema', async () => {
  const registry = setup()
  const profile = registry.createProfile('Existing profile')
  const options = {
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  }
  const original = await openProfileApplication({
    ...options,
    migrations: CURRENT_MIGRATIONS.slice(0, 1),
  })
  original.close()
  const upgraded = await openProfileApplication(options)
  try {
    expect(upgraded.queries.getProfileInfo()).toMatchObject({
      id: profile.id,
      name: 'Existing profile',
    })
    expect(upgraded.queries.getSettings()).toEqual({
      language: 'en',
      theme: 'system',
      baseCurrency: 'HUF',
    })
  } finally {
    upgraded.close()
  }
})
