import Database from 'better-sqlite3'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { ProfileRegistry } from './profile-registry'
import { ProfileController } from './profile-controller'
import {
  CURRENT_MIGRATIONS,
  MigrationError,
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
  test('quick-add opens the last used profile and creates a normal undoable transaction', async () => {
    const { registry } = setup()
    const controller = new ProfileController(registry, 'en', { clock })
    const first = await controller.create('First')
    const lastUsed = await controller.create('Last used')
    await controller.open(first.id)
    await controller.close()
    await controller.open(lastUsed.id)
    const account = controller.getActiveApplication().commands.createAccount({
      name: 'Quick account',
      currency: 'HUF',
      openingBalance: 0,
      openingDate: '2026-01-01',
    })
    await controller.close()

    const opened = await controller.openLastUsed()
    expect(opened?.id).toBe(lastUsed.id)
    const application = controller.getActiveApplication()
    const transaction = application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 12345,
      payeeName: 'Quick payee',
      categoryId: null,
      note: 'Quick add',
      tagNames: ['Fast'],
      excluded: false,
    })
    expect(application.queries.listTransactions().rows).toEqual([transaction])
    expect(application.commands.undoLast()).toBe(true)
    expect(application.queries.listTransactions().rows).toEqual([])
    await controller.close()
  })

  test('opening a profile creates a startup backup separate from migration backups', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Startup backup')
    const paths = registry.getProfilePaths(profile.id)
    const application = await openProfileApplication({ profile, paths, clock })
    try {
      expect(application.queries.listBackups()).toEqual([
        { id: expect.any(String), createdAt: '2026-01-15T10:00:00.000Z' },
      ])
      expect(readdirSync(paths.preMigrationBackupDirectory)).toEqual([])
    } finally {
      application.close()
    }
  })

  test.each([
    ['hu-HU', 'hu'],
    ['de-DE', 'de'],
    ['fr-FR', 'en'],
  ] as const)(
    'new profiles use the %s system locale and take one backup on their first real open',
    async (locale, language) => {
      const { registry } = setup()
      const controller = new ProfileController(registry, locale)
      const profile = await controller.create(`Locale ${locale}`)
      const paths = registry.getProfilePaths(profile.id)
      expect(
        readdirSync(paths.backupDirectory).filter((name) =>
          name.endsWith('.sqlite'),
        ),
      ).toEqual([])
      const active = await controller.open(profile.id)
      expect(active.settings).toEqual({
        language,
        theme: 'system',
        baseCurrency: 'HUF',
        privacyMode: false,
        watchedFolder: null,
      })
      expect(controller.listBackups()).toHaveLength(1)
      await controller.close()
    },
  )

  test('failed active-profile deletion reopens the profile instead of stranding the app', async () => {
    const userDataDirectory = mkdtempSync(
      join(tmpdir(), 'financial-tracker-delete-recovery-'),
    )
    temporaryDirectories.push(userDataDirectory)
    let blockDeletion = false
    const registry = new ProfileRegistry({
      userDataDirectory,
      renameProfileDirectory(source, destination) {
        if (blockDeletion) throw new Error('Synthetic directory lock')
        renameSync(source, destination)
      },
    })
    const controller = new ProfileController(registry)
    const profile = await controller.create('Kept active')
    await controller.open(profile.id)
    blockDeletion = true
    await expect(controller.delete(profile.id, profile.name)).rejects.toThrow(
      'profiles.error.delete',
    )
    expect(controller.getActive()?.id).toBe(profile.id)
    expect(controller.list().profiles).toEqual([profile])
    await controller.close()
  })

  test('keeps the last ten startup backups, including repeated opens at the same time', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Retention')
    const paths = registry.getProfilePaths(profile.id)
    const ids: string[] = []
    for (let index = 0; index < 12; index += 1) {
      const application = await openProfileApplication({
        profile,
        paths,
        clock,
      })
      try {
        const backups = application.queries.listBackups()
        ids.push(backups[0].id)
        expect(backups.map((backup) => backup.id)).toEqual(
          ids.slice(-10).reverse(),
        )
      } finally {
        application.close()
      }
    }
  })

  test('restores a chosen snapshot after confirmation and can use the reopened database', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Restore')
    const paths = registry.getProfilePaths(profile.id)
    const application = await openProfileApplication({ profile, paths, clock })
    const backup = application.queries.listBackups()[0]
    // Arrange later data through a fixture connection: the foundation has no financial writes yet.
    const writer = new Database(paths.databasePath)
    writer
      .prepare('UPDATE profile_identity SET created_at = ?')
      .run('2026-01-16T10:00:00.000Z')
    writer.close()
    try {
      await expect(
        application.commands.restoreBackup({
          backupId: backup.id,
          confirmed: false,
        }),
      ).rejects.toThrow('confirmation')
      expect(application.queries.getProfileInfo().createdAt).toBe(
        '2026-01-16T10:00:00.000Z',
      )
      await application.commands.restoreBackup({
        backupId: backup.id,
        confirmed: true,
      })
      expect(application.queries.getProfileInfo()).toMatchObject({
        id: profile.id,
        createdAt: profile.createdAt,
      })
      application.commands.ensureProfileIdentity()
    } finally {
      application.close()
    }
    const reopened = await openProfileApplication({ profile, paths, clock })
    try {
      expect(reopened.queries.getProfileInfo().createdAt).toBe(
        profile.createdAt,
      )
    } finally {
      reopened.close()
    }
  })

  test('controller restore returns saved settings and restores accounts while blocking overlapping operations', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Saved finances')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    const settings = {
      language: 'de',
      theme: 'dark',
      baseCurrency: 'CHF',
    } as const
    const account = initial.commands.createAccount({
      name: 'Saved account',
      currency: 'CHF',
      openingBalance: 12345,
      openingDate: '2026-01-01',
    })
    initial.commands.updateSettings(settings)
    initial.close()

    const controller = new ProfileController(registry)
    await controller.open(profile.id)
    try {
      const backup = controller.listBackups()[0]
      await controller.updateSettings({
        id: profile.id,
        settings: { language: 'en', theme: 'light', baseCurrency: 'HUF' },
      })
      const application = controller.getActiveApplication()
      application.commands.renameAccount({ id: account.id, name: 'Later name' })
      application.commands.archiveAccount(account.id)
      const restoring = controller.restoreBackup({
        backupId: backup.id,
        confirmed: true,
      })
      expect(() => controller.getActiveApplication()).toThrow(
        'operation is in progress',
      )
      expect(() =>
        controller.updateSettings({
          id: profile.id,
          settings: { language: 'hu' },
        }),
      ).toThrow('operation is in progress')
      const restored = await restoring
      expect(restored).toMatchObject({
        id: profile.id,
        schemaVersion: currentVersion,
        settings,
      })
      expect(controller.getActive()).toEqual(restored)
      expect(application.queries.listAccounts()).toEqual([account])
      expect(application.queries.listAccountOptions()).toEqual([
        {
          id: account.id,
          name: account.name,
          currency: account.currency,
          archived: false,
        },
      ])
    } finally {
      await controller.close()
    }
  })

  test('restoring a settings-only snapshot upgrades to accounts without changing its saved settings', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Older settings snapshot')
    const paths = registry.getProfilePaths(profile.id)
    const options = { profile, paths, clock }
    const settings = {
      language: 'hu',
      theme: 'dark',
      baseCurrency: 'CHF',
    } as const
    const olderOptions = {
      ...options,
      migrations: CURRENT_MIGRATIONS.slice(0, 2),
    }
    const initial = await openProfileApplication(olderOptions)
    initial.close()
    // Arrange a historical schema snapshot with its historical settings columns.
    const fixture = new Database(paths.databasePath)
    try {
      fixture
        .prepare(
          'UPDATE profile_settings SET language = ?, theme = ?, base_currency = ? WHERE id = 1',
        )
        .run(settings.language, settings.theme, settings.baseCurrency)
    } finally {
      fixture.close()
    }
    const older = await openProfileApplication(olderOptions)
    const backup = older.queries.listBackups()[0]
    older.close()

    const application = await openProfileApplication(options)
    try {
      expect(application.queries.getSettings()).toEqual({
        ...settings,
        privacyMode: false,
        watchedFolder: null,
      })
      application.commands.createAccount({
        name: 'Later account',
        currency: 'HUF',
        openingBalance: 0,
        openingDate: '2026-01-01',
      })
      application.commands.updateSettings({ language: 'de' })
      await application.commands.restoreBackup({
        backupId: backup.id,
        confirmed: true,
      })
      expect(application.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion,
      )
      expect(application.queries.getSettings()).toEqual({
        ...settings,
        privacyMode: false,
        watchedFolder: null,
      })
      expect(application.queries.listAccounts()).toEqual([])
      const created = application.commands.createAccount({
        name: 'Restored account',
        currency: 'CHF',
        openingBalance: -12345,
        openingDate: '2026-01-01',
      })
      expect(created.createdAt).toBe(clock().toISOString())
      expect(application.queries.listAccounts()).toEqual([created])
    } finally {
      application.close()
    }
  })

  test('startup backup is consistent while another connection has an uncommitted write', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Writing')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    initial.close()
    const writer = new Database(paths.databasePath)
    writer.pragma('journal_mode = WAL')
    writer.exec('BEGIN IMMEDIATE')
    writer
      .prepare('UPDATE profile_identity SET created_at = ?')
      .run('2026-01-16T10:00:00.000Z')
    let application:
      Awaited<ReturnType<typeof openProfileApplication>> | undefined
    try {
      application = await openProfileApplication({ profile, paths, clock })
      const backup = application.queries.listBackups()[0]
      writer.exec('COMMIT')
      writer.close()
      expect(application.queries.getProfileInfo().createdAt).toBe(
        '2026-01-16T10:00:00.000Z',
      )
      await application.commands.restoreBackup({
        backupId: backup.id,
        confirmed: true,
      })
      expect(application.queries.getProfileInfo().createdAt).toBe(
        profile.createdAt,
      )
      application.commands.ensureProfileIdentity()
    } finally {
      if (writer.open) writer.close()
      application?.close()
    }
  })

  test('rejects unknown and cross-profile backup identifiers without changing the open profile', async () => {
    const { registry } = setup()
    const first = registry.createProfile('First backup')
    const second = registry.createProfile('Second backup')
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
      for (const backupId of [
        '../../profile.sqlite',
        secondApplication.queries.listBackups()[0].id,
      ]) {
        await expect(
          firstApplication.commands.restoreBackup({
            backupId,
            confirmed: true,
          }),
        ).rejects.toThrow('backups.error.notFound')
        expect(firstApplication.queries.getProfileInfo().id).toBe(first.id)
      }
    } finally {
      firstApplication.close()
      secondApplication.close()
    }
  })

  test('reopens the previous database when upgrading a restored older snapshot fails', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Restore upgrade failure')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    const olderBackup = initial.queries.listBackups()[0]
    initial.close()
    let failUpgrade = false
    const nextMigration = defineSqlMigration(
      currentVersion + 1,
      'restored schema upgrade',
      'CREATE TABLE restored_upgrade (value TEXT)',
    )
    const application = await openProfileApplication({
      profile,
      paths,
      clock,
      migrations: [
        ...CURRENT_MIGRATIONS,
        {
          ...nextMigration,
          apply(database) {
            nextMigration.apply(database)
            if (failUpgrade) throw new Error('Upgrade unavailable')
          },
        },
      ],
    })
    try {
      failUpgrade = true
      await expect(
        application.commands.restoreBackup({
          backupId: olderBackup.id,
          confirmed: true,
        }),
      ).rejects.toThrow('backups.error.restore')
      expect(application.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion + 1,
      )
      application.commands.ensureProfileIdentity()
    } finally {
      application.close()
    }
  })

  test('recovers the previous database if a restored migration leaves the profile identity invalid', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Restore identity validation')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    const olderBackup = initial.queries.listBackups()[0]
    initial.close()
    let invalidateIdentity = false
    const nextMigration = defineSqlMigration(
      currentVersion + 1,
      'identity validation upgrade',
      'CREATE TABLE identity_upgrade (value TEXT)',
    )
    const application = await openProfileApplication({
      profile,
      paths,
      clock,
      migrations: [
        ...CURRENT_MIGRATIONS,
        {
          ...nextMigration,
          apply(database) {
            nextMigration.apply(database)
            if (invalidateIdentity)
              database.exec(
                "UPDATE profile_identity SET created_at = '2026-01-16T10:00:00.000Z'",
              )
          },
        },
      ],
    })
    try {
      invalidateIdentity = true
      await expect(
        application.commands.restoreBackup({
          backupId: olderBackup.id,
          confirmed: true,
        }),
      ).rejects.toThrow('backups.error.restore')
      expect(application.queries.getProfileInfo()).toMatchObject({
        createdAt: profile.createdAt,
        schemaVersion: currentVersion + 1,
      })
      application.commands.ensureProfileIdentity()
    } finally {
      application.close()
    }
  })

  test('rejects a corrupt snapshot without closing or changing the live database', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Corrupt backup')
    const paths = registry.getProfilePaths(profile.id)
    const application = await openProfileApplication({ profile, paths, clock })
    try {
      const backup = application.queries.listBackups()[0]
      const filename = readdirSync(paths.backupDirectory).find((name) =>
        name.endsWith(`${backup.id}.sqlite`),
      )!
      writeFileSync(
        join(paths.backupDirectory, filename),
        'not a SQLite database',
      )
      await expect(
        application.commands.restoreBackup({
          backupId: backup.id,
          confirmed: true,
        }),
      ).rejects.toThrow()
      expect(application.queries.getProfileInfo().id).toBe(profile.id)
      application.commands.ensureProfileIdentity()
    } finally {
      application.close()
    }
  })

  test('rejects a snapshot with a newer schema without changing the live database', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Newer backup')
    const paths = registry.getProfilePaths(profile.id)
    const application = await openProfileApplication({ profile, paths, clock })
    try {
      const backup = application.queries.listBackups()[0]
      const filename = readdirSync(paths.backupDirectory).find((name) =>
        name.endsWith(`${backup.id}.sqlite`),
      )!
      const futureFixture = new Database(join(paths.backupDirectory, filename))
      futureFixture
        .prepare(
          'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          currentVersion + 1,
          'future schema',
          '0'.repeat(64),
          clock().toISOString(),
        )
      futureFixture.close()
      await expect(
        application.commands.restoreBackup({
          backupId: backup.id,
          confirmed: true,
        }),
      ).rejects.toThrow('backups.error.newerSchema')
      expect(application.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion,
      )
      application.commands.ensureProfileIdentity()
    } finally {
      application.close()
    }
  })

  test('rejects another profile database even when its file replaces a listed backup', async () => {
    const { registry } = setup()
    const first = registry.createProfile('Original backup')
    const other = registry.createProfile('Foreign backup')
    const paths = registry.getProfilePaths(first.id)
    const application = await openProfileApplication({
      profile: first,
      paths,
      clock,
    })
    const foreignPaths = registry.getProfilePaths(other.id)
    const foreign = await openProfileApplication({
      profile: other,
      paths: foreignPaths,
      clock,
    })
    foreign.close()
    try {
      const backup = application.queries.listBackups()[0]
      const filename = readdirSync(paths.backupDirectory).find((name) =>
        name.endsWith(`${backup.id}.sqlite`),
      )!
      copyFileSync(
        foreignPaths.databasePath,
        join(paths.backupDirectory, filename),
      )
      await expect(
        application.commands.restoreBackup({
          backupId: backup.id,
          confirmed: true,
        }),
      ).rejects.toThrow('backups.error.foreign')
      expect(application.queries.getProfileInfo().id).toBe(first.id)
    } finally {
      application.close()
    }
  })

  test('blocks overlapping writes and close until restore has safely reopened the profile', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Restore lifecycle')
    const paths = registry.getProfilePaths(profile.id)
    const application = await openProfileApplication({ profile, paths, clock })
    try {
      const backup = application.queries.listBackups()[0]
      const restoring = application.commands.restoreBackup({
        backupId: backup.id,
        confirmed: true,
      })
      expect(() => application.commands.ensureProfileIdentity()).toThrow(
        'restore is in progress',
      )
      expect(() =>
        application.commands.createTransaction({
          accountId: '00000000-0000-4000-8000-000000000001',
          kind: 'expense',
          date: '2026-01-15',
          totalMinor: 100,
          payeeName: null,
          categoryId: null,
          note: '',
        }),
      ).toThrow('restore is in progress')
      expect(() => application.close()).toThrow('restore is in progress')
      await expect(
        application.commands.restoreBackup({
          backupId: backup.id,
          confirmed: true,
        }),
      ).rejects.toThrow('restore is in progress')
      await restoring
      application.commands.ensureProfileIdentity()
      expect(application.queries.getProfileInfo().id).toBe(profile.id)
    } finally {
      application.close()
    }
  })

  test('startup pruning never removes pre-migration backups', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Migration retention')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({ profile, paths, clock })
    initial.close()
    const migrations = [
      ...CURRENT_MIGRATIONS,
      defineSqlMigration(
        currentVersion + 1,
        'retention upgrade',
        'CREATE TABLE retention_upgrade (value TEXT)',
      ),
    ]
    for (let index = 0; index < 12; index += 1) {
      const application = await openProfileApplication({
        profile,
        paths,
        migrations,
        clock,
      })
      try {
        if (index === 11)
          expect(application.queries.listBackups()).toHaveLength(10)
      } finally {
        application.close()
      }
    }
    expect(readdirSync(paths.preMigrationBackupDirectory)).toHaveLength(1)
  })

  test('two profiles isolate transactions and payees through the application API', async () => {
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
      const firstAccount = firstApplication.commands.createAccount({
        name: 'First cash',
        currency: 'HUF',
        openingBalance: 0,
        openingDate: '2026-01-01',
      })
      const firstTransaction = firstApplication.commands.createTransaction({
        accountId: firstAccount.id,
        kind: 'expense',
        date: '2026-01-15',
        totalMinor: 123,
        payeeName: 'First payee',
        categoryId: null,
        note: '',
      })
      expect(secondApplication.queries.listTransactions().rows).toEqual([])
      expect(secondApplication.queries.listPayees()).toEqual([])
      const secondAccount = secondApplication.commands.createAccount({
        name: 'Second cash',
        currency: 'HUF',
        openingBalance: 0,
        openingDate: '2026-01-01',
      })
      const secondTransaction = secondApplication.commands.createTransaction({
        accountId: secondAccount.id,
        kind: 'income',
        date: '2026-01-15',
        totalMinor: 456,
        payeeName: 'Second payee',
        categoryId: null,
        note: '',
      })
      expect(firstApplication.queries.listTransactions().rows).toEqual([
        firstTransaction,
      ])
      expect(
        firstApplication.queries.listPayees().map(({ name }) => name),
      ).toEqual(['First payee'])
      expect(secondApplication.queries.listTransactions().rows).toEqual([
        secondTransaction,
      ])
      expect(
        secondApplication.queries.listPayees().map(({ name }) => name),
      ).toEqual(['Second payee'])
    } finally {
      firstApplication.close()
      secondApplication.close()
    }
  })

  test('switching profiles clears transaction undo history', async () => {
    const { registry } = setup()
    const first = registry.createProfile('First undo profile')
    const second = registry.createProfile('Second undo profile')
    const controller = new ProfileController(registry)
    await controller.open(first.id)
    const firstApplication = controller.getActiveApplication()
    const account = firstApplication.commands.createAccount({
      name: 'Cash',
      currency: 'HUF',
      openingBalance: 0,
      openingDate: '2026-01-01',
    })
    const transaction = firstApplication.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 100,
      payeeName: null,
      categoryId: null,
      note: '',
    })

    await controller.open(second.id)
    expect(controller.getActiveApplication().commands.undoLast()).toBe(false)
    await controller.open(first.id)
    expect(controller.getActiveApplication().commands.undoLast()).toBe(false)
    expect(
      controller.getActiveApplication().queries.listTransactions().rows,
    ).toEqual([transaction])
    await controller.close()
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
          createStartupBackup: false,
          startBackgroundWork: false,
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
          privacyMode: false,
          watchedFolder: null,
        })
      } finally {
        upgraded.close()
      }
    }
  })

  test('applies dependent pending migrations atomically and records each one', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Dependent migrations')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({
      profile,
      paths,
      clock,
      createStartupBackup: false,
      startBackgroundWork: false,
    })
    initial.close()
    const createsDeferredReference = defineSqlMigration(
      currentVersion + 1,
      'create a deferred migration reference',
      `
        CREATE TABLE migration_parents (id INTEGER PRIMARY KEY);
        CREATE TABLE migration_children (
          parent_id INTEGER NOT NULL REFERENCES migration_parents(id)
        );
        PRAGMA defer_foreign_keys = ON;
        INSERT INTO migration_children (parent_id) VALUES (1);
      `,
    )
    const resolvesDeferredReference = defineSqlMigration(
      currentVersion + 2,
      'resolve the deferred migration reference',
      'INSERT INTO migration_parents (id) VALUES (1)',
    )
    const observesEarlierMigrations = defineSqlMigration(
      currentVersion + 3,
      'observe earlier pending migrations',
      'CREATE TABLE migration_chain_complete (value TEXT NOT NULL)',
    )
    let observedRows: unknown[] = []
    let observedReferenceCount = 0
    const observer = {
      ...observesEarlierMigrations,
      apply(database: Database.Database) {
        observesEarlierMigrations.apply(database)
        observedRows = database
          .prepare(
            'SELECT version, name FROM schema_migrations WHERE version > ? ORDER BY version',
          )
          .all(currentVersion)
        observedReferenceCount = database
          .prepare(
            `SELECT count(*) AS count
             FROM migration_children child
             JOIN migration_parents parent ON parent.id = child.parent_id`,
          )
          .pluck()
          .get() as number
      },
    }
    const migrations = [
      ...CURRENT_MIGRATIONS,
      createsDeferredReference,
      resolvesDeferredReference,
      observer,
    ]

    const upgraded = await openProfileApplication({
      profile,
      paths,
      migrations,
      clock,
      createStartupBackup: false,
      startBackgroundWork: false,
    })
    expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(
      currentVersion + 3,
    )
    expect(observedRows).toEqual([
      {
        version: currentVersion + 1,
        name: 'create a deferred migration reference',
      },
      {
        version: currentVersion + 2,
        name: 'resolve the deferred migration reference',
      },
    ])
    expect(observedReferenceCount).toBe(1)
    upgraded.close()

    const reopened = await openProfileApplication({
      profile,
      paths,
      migrations,
      clock,
      createStartupBackup: false,
      startBackgroundWork: false,
    })
    try {
      expect(reopened.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion + 3,
      )
    } finally {
      reopened.close()
    }
  })

  test('a later failing migration restores the database and keeps its verified backup', async () => {
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
    const successfulMigration = defineSqlMigration(
      currentVersion + 1,
      'succeeds before a later failure',
      'CREATE TABLE should_be_rolled_back (value TEXT)',
    )
    const failingMigration = defineSqlMigration(
      currentVersion + 2,
      'fails after changing the schema',
      'CREATE TABLE failure_side_effect (value TEXT); INVALID SQL',
    )

    let failure: unknown
    try {
      await openProfileApplication({
        profile,
        paths,
        migrations: [
          ...CURRENT_MIGRATIONS,
          successfulMigration,
          failingMigration,
        ],
        clock,
        createStartupBackup: false,
        startBackgroundWork: false,
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(MigrationError)
    expect(failure).toMatchObject({
      message: 'profiles.error.migration',
      migrationVersion: currentVersion + 2,
      migrationName: 'fails after changing the schema',
      backupPath: expect.any(String),
      cause: expect.objectContaining({ code: 'SQLITE_ERROR' }),
    })

    const reopened = await openProfileApplication({
      profile,
      paths,
      clock,
      createStartupBackup: false,
      startBackgroundWork: false,
    })
    try {
      expect(reopened.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion,
      )
      expect(reopened.queries.listAccounts()).toEqual([account])
      expect(reopened.queries.getSettings()).toEqual({
        language: 'hu',
        theme: 'dark',
        baseCurrency: 'CHF',
        privacyMode: false,
        watchedFolder: null,
      })
    } finally {
      reopened.close()
    }
    const backups = readdirSync(paths.preMigrationBackupDirectory)
    expect(backups).toHaveLength(1)
    expect((failure as MigrationError).backupPath).toBe(
      join(paths.preMigrationBackupDirectory, backups[0]),
    )
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
      createStartupBackup: false,
      startBackgroundWork: false,
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
        privacyMode: false,
        watchedFolder: null,
      })
    } finally {
      backupApplication.close()
    }
  })

  test('a later failing migration removes a new database and reports the failure', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('New migration failure')
    const paths = registry.getProfilePaths(profile.id)
    const successfulMigration = defineSqlMigration(
      currentVersion + 1,
      'succeeds in a new database',
      'CREATE TABLE new_database_side_effect (value TEXT)',
    )
    const failingMigration = defineSqlMigration(
      currentVersion + 2,
      'fails in a new database',
      'INVALID SQL',
    )

    let failure: unknown
    try {
      await openProfileApplication({
        profile,
        paths,
        migrations: [
          ...CURRENT_MIGRATIONS,
          successfulMigration,
          failingMigration,
        ],
        clock,
        createStartupBackup: false,
        startBackgroundWork: false,
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(MigrationError)
    expect(failure).toMatchObject({
      message: 'profiles.error.migration',
      migrationVersion: currentVersion + 2,
      migrationName: 'fails in a new database',
      backupPath: null,
      cause: expect.objectContaining({ code: 'SQLITE_ERROR' }),
    })
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      expect(existsSync(`${paths.databasePath}${suffix}`)).toBe(false)
    }
  })

  test('a final commit failure restores the verified backup', async () => {
    const { registry } = setup()
    const profile = registry.createProfile('Migration commit failure')
    const paths = registry.getProfilePaths(profile.id)
    const initial = await openProfileApplication({
      profile,
      paths,
      clock,
      createStartupBackup: false,
      startBackgroundWork: false,
    })
    const account = initial.commands.createAccount({
      name: 'Preserved after commit failure',
      currency: 'HUF',
      openingBalance: 12345,
      openingDate: '2026-01-01',
    })
    initial.close()
    const commitFailure = defineSqlMigration(
      currentVersion + 1,
      'fails during the final commit',
      `
        CREATE TABLE commit_failure_parents (id INTEGER PRIMARY KEY);
        CREATE TABLE commit_failure_children (
          parent_id INTEGER NOT NULL REFERENCES commit_failure_parents(id)
        );
        PRAGMA defer_foreign_keys = ON;
        INSERT INTO commit_failure_children (parent_id) VALUES (1);
      `,
    )
    let applyCompleted = false
    const migration = {
      ...commitFailure,
      apply(database: Database.Database) {
        commitFailure.apply(database)
        applyCompleted = true
      },
    }

    let failure: unknown
    try {
      await openProfileApplication({
        profile,
        paths,
        migrations: [...CURRENT_MIGRATIONS, migration],
        clock,
        createStartupBackup: false,
        startBackgroundWork: false,
      })
    } catch (error) {
      failure = error
    }
    expect(applyCompleted).toBe(true)
    expect(failure).toBeInstanceOf(MigrationError)
    expect(failure).toMatchObject({
      message: 'profiles.error.migration',
      migrationVersion: currentVersion + 1,
      migrationName: 'fails during the final commit',
      backupPath: expect.any(String),
      cause: expect.objectContaining({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }),
    })

    const reopened = await openProfileApplication({
      profile,
      paths,
      clock,
      createStartupBackup: false,
      startBackgroundWork: false,
    })
    try {
      expect(reopened.queries.getProfileInfo().schemaVersion).toBe(
        currentVersion,
      )
      expect(reopened.queries.listAccounts()).toEqual([account])
    } finally {
      reopened.close()
    }
    expect(readdirSync(paths.preMigrationBackupDirectory)).toHaveLength(1)
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
