import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { ProfileRegistry } from './profile-registry'
import {
  CURRENT_MIGRATIONS,
  NewerSchemaError,
  defineSqlMigration,
  openProfileApplication,
} from './profile-application'

const temporaryDirectories: string[] = []
const currentVersion = CURRENT_MIGRATIONS.length
const clock = () => new Date('2026-01-15T10:00:00.000Z')

function setup() {
  const userDataDirectory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-profile-'),
  )
  temporaryDirectories.push(userDataDirectory)
  const registry = new ProfileRegistry({ userDataDirectory, clock })
  return { registry }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('profile application API', () => {
  test('two profiles can only query their own profile data', async () => {
    const { registry } = setup()
    const first = registry.createProfile('First')
    const second = registry.createProfile('Second')
    const firstApplication = await openProfileApplication({
      profile: first,
      paths: registry.getProfilePaths(first.id),
      clock,
    })
    const secondApplication = await openProfileApplication({
      profile: second,
      paths: registry.getProfilePaths(second.id),
      clock,
    })

    try {
      expect(firstApplication.queries.getProfileInfo()).toMatchObject({
        id: first.id,
        name: 'First',
      })
      expect(secondApplication.queries.getProfileInfo()).toMatchObject({
        id: second.id,
        name: 'Second',
      })
      expect(firstApplication.queries.getProfileInfo().id).not.toBe(
        secondApplication.queries.getProfileInfo().id,
      )
    } finally {
      firstApplication.close()
      secondApplication.close()
    }
  })

  test('upgrades from every earlier schema version', async () => {
    const secondMigration = defineSqlMigration(
      currentVersion + 1,
      'migration mechanism proof',
      'CREATE TABLE migration_proof (value TEXT NOT NULL)',
    )
    const migrations = [...CURRENT_MIGRATIONS, secondMigration]

    for (const startingVersion of Array.from(
      { length: currentVersion + 1 },
      (_, version) => version,
    )) {
      const { registry } = setup()
      const profile = registry.createProfile(`Version ${startingVersion}`)
      const paths = registry.getProfilePaths(profile.id)

      if (startingVersion === 0) {
        const database = new Database(paths.databasePath)
        database.exec('CREATE TABLE legacy_data (value TEXT NOT NULL)')
        database.close()
      } else {
        const application = await openProfileApplication({
          profile,
          paths,
          migrations: CURRENT_MIGRATIONS.slice(0, startingVersion),
          clock,
        })
        application.close()
      }

      const upgraded = await openProfileApplication({
        profile,
        paths,
        migrations,
        clock,
      })
      try {
        expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(
          currentVersion + 1,
        )
        expect(upgraded.queries.listAccounts()).toEqual([])
        expect(upgraded.queries.getSettings()).toEqual({
          language: 'en',
          theme: 'system',
          baseCurrency: 'HUF',
        })
      } finally {
        upgraded.close()
      }
    }
  })

  test('a failing migration restores the database and keeps its verified backup', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Migration failure')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    const account = initial.commands.createAccount({
      name: 'Preserved account',
      currency: 'HUF',
      openingBalance: 12345,
      openingDate: '2026-01-01',
    })
    initial.commands.updateSettings({
      language: 'hu',
      theme: 'dark',
      baseCurrency: 'CHF',
    })
    initial.close()
    const failingMigration = defineSqlMigration(
      currentVersion + 1,
      'fails after changing the schema',
      'CREATE TABLE should_be_rolled_back (value TEXT); INVALID SQL',
    )

    await expect(
      openProfileApplication({
        profile,
        paths,
        migrations: [...CURRENT_MIGRATIONS, failingMigration],
        clock,
      }),
    ).rejects.toThrow('fails after changing the schema')

    const reopened = await openProfileApplication({ profile, paths, clock })
    try {
      expect(reopened.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion,
      )
      expect(reopened.queries.listAccounts()).toEqual([account])
      expect(reopened.queries.getSettings()).toEqual({
        language: 'hu',
        theme: 'dark',
        baseCurrency: 'CHF',
      })
    } finally {
      reopened.close()
    }
    const backups = readdirSync(paths.preMigrationBackupDirectory)
    expect(backups).toHaveLength(1)
    const backupApplication = await openProfileApplication({
      profile,
      paths: {
        ...paths,
        databasePath: join(paths.preMigrationBackupDirectory, backups[0]),
        dataDirectory: join(paths.profileDirectory, 'backup-test-data'),
        preMigrationBackupDirectory: join(
          paths.profileDirectory,
          'backup-test-pre-migration',
        ),
      },
      clock,
    })
    try {
      expect(backupApplication.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion,
      )
      expect(backupApplication.queries.listAccounts()).toEqual([account])
      expect(backupApplication.queries.getSettings()).toEqual({
        language: 'hu',
        theme: 'dark',
        baseCurrency: 'CHF',
      })
    } finally {
      backupApplication.close()
    }
  })

  test('refuses a changed checksum for an already applied migration', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Checksum')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    initial.close()
    const changedFirstMigration = defineSqlMigration(
      1,
      'initial profile schema',
      'CREATE TABLE profile_identity (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)',
    )

    await expect(
      openProfileApplication({
        profile,
        paths,
        migrations: [changedFirstMigration, ...CURRENT_MIGRATIONS.slice(1)],
        clock,
      }),
    ).rejects.toThrow('migration record 1 is invalid')
  })

  test('refuses to open a database with a newer schema', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Newer schema')
    const paths = registry.getProfilePaths(profile.id)
    const secondMigration = defineSqlMigration(
      currentVersion + 1,
      'future schema',
      'CREATE TABLE future_data (value TEXT NOT NULL)',
    )
    const futureApplication = await openProfileApplication({
      profile,
      paths,
      migrations: [...CURRENT_MIGRATIONS, secondMigration],
      clock,
    })
    futureApplication.close()

    await expect(
      openProfileApplication({
        profile,
        paths,
        migrations: CURRENT_MIGRATIONS,
        clock,
      }),
    ).rejects.toBeInstanceOf(NewerSchemaError)
    expect(existsSync(paths.databasePath)).toBe(true)
  })
})
