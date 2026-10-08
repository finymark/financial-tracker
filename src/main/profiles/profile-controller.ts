import type {
  ProfileBackup,
  RestoreBackupInput,
  ActiveProfileInfo,
  UpdateProfileSettingsInput,
  ProfileRegistrySnapshot,
  ProfileSummary,
} from '../../shared/profiles'
import type { ProfileSettings } from '../../shared/settings'
import type {
  Language,
  WatchedFolderFailure,
  WatchedFolderStatus,
} from '../../shared/settings'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'
import type { ExchangeRateSource } from '../exchange-rates/exchange-rate-source'
import type { OcrEngine } from '../ocr/ocr-engine'
import {
  WatchedFolderIntake,
  type WatchedFolderIntakeOptions,
} from '../watched-folder-intake'

interface ProfileControllerOptions {
  exchangeRateSource?: ExchangeRateSource
  onRateStatusChanged?: () => void
  onPendingTransactionsChanged?: () => void
  onReceiptInboxChanged?: () => void
  watchedFolderOptions?: Omit<
    WatchedFolderIntakeOptions,
    'onStatusChanged' | 'onFailure'
  >
  onWatchedFolderStatusChanged?: (status: WatchedFolderStatus | null) => void
  onWatchedFolderFailure?: (failure: WatchedFolderFailure) => void
  ocrEngine?: OcrEngine
  logger?: Pick<Console, 'error'>
  clock?: () => Date
}

export class ProfileController {
  readonly #registry: ProfileRegistry
  readonly #defaultLanguage: Language
  readonly #options: ProfileControllerOptions
  readonly #watchedFolder: WatchedFolderIntake
  #changing = false
  #shuttingDown = false
  #pending: Promise<unknown> | null = null
  #active: { id: string; application: ProfileApplication } | null = null
  #shutdownProfileId: string | null = null
  #watchedFolderStatus: WatchedFolderStatus | null = null
  #watchedFolderOperation: Promise<void> = Promise.resolve()

  constructor(
    registry: ProfileRegistry,
    systemLocale = 'en',
    options: ProfileControllerOptions = {},
  ) {
    this.#registry = registry
    this.#options = options
    const language = systemLocale.toLowerCase().split(/[-_]/)[0]
    this.#defaultLanguage =
      language === 'hu' || language === 'de' ? language : 'en'
    this.#watchedFolder = new WatchedFolderIntake(
      (input) => {
        const application = this.#active?.application
        if (!application) return Promise.reject(new Error('No profile is open'))
        return application.commands.intakeReceipt(input, 'folder')
      },
      {
        ...options.watchedFolderOptions,
        logger: options.watchedFolderOptions?.logger ?? options.logger,
        onStatusChanged: (status) => this.#setWatchedFolderStatus(status),
        onFailure: (failure) => options.onWatchedFolderFailure?.(failure),
      },
    )
  }

  list(): ProfileRegistrySnapshot {
    return {
      profiles: this.#registry.listProfiles(),
      lastUsedProfileId: this.#registry.getLastUsedProfileId(),
    }
  }

  async create(name: string): Promise<ProfileSummary> {
    return this.#changeProfile(async () => {
      const profile = this.#registry.createProfile(name)
      try {
        const application = await openProfileApplication({
          profile,
          paths: this.#registry.getProfilePaths(profile.id),
          createStartupBackup: false,
          ...this.#applicationOptions(),
          startBackgroundWork: false,
        })
        application.commands.updateSettings({ language: this.#defaultLanguage })
        application.close()
        return profile
      } catch (error) {
        this.#registry.deleteProfile(profile.id, profile.name)
        throw error
      }
    })
  }

  rename(id: string, name: string): ProfileSummary {
    this.#assertIdle()
    return this.#registry.renameProfile(id, name)
  }

  async delete(id: string, confirmation: string): Promise<void> {
    return this.#changeProfile(async () => {
      if (
        this.#active?.id === id &&
        this.#registry.getProfile(id).name !== confirmation
      ) {
        throw new Error('profiles.error.confirmation')
      }
      const wasActive = this.#active?.id === id
      if (wasActive) await this.#closeActive()
      try {
        this.#registry.deleteProfile(id, confirmation)
      } catch (error) {
        if (wasActive) {
          const profile = this.#registry.getProfile(id)
          const application = await openProfileApplication({
            profile,
            paths: this.#registry.getProfilePaths(id),
            ...this.#applicationOptions(),
            startBackgroundWork: false,
          })
          this.#active = { id, application }
          application.startBackgroundWork()
          await this.#startWatchedFolder()
        }
        throw error
      }
    })
  }

  async open(id: string): Promise<ActiveProfileInfo> {
    return this.#changeProfile(async () => {
      await this.#stopWatchedFolder()
      let application: ProfileApplication | null = null
      try {
        const profile = this.#registry.getProfile(id)
        application = await openProfileApplication({
          profile,
          paths: this.#registry.getProfilePaths(id),
          ...this.#applicationOptions(),
          startBackgroundWork: false,
        })
        this.#registry.rememberLastUsed(id)
      } catch (error) {
        application?.close()
        await this.#startWatchedFolder()
        throw error
      }
      await this.#closeActive()
      this.#active = { id, application }
      application.startBackgroundWork()
      await this.#startWatchedFolder()
      return this.getActive() as ActiveProfileInfo
    })
  }

  async openLastUsed(): Promise<ActiveProfileInfo | null> {
    const active = this.getActive()
    if (active) return active
    const id = this.#registry.getLastUsedProfileId()
    return id ? this.open(id) : null
  }

  getActive(): ActiveProfileInfo | null {
    if (!this.#active) return null
    const info = this.#active.application.queries.getProfileInfo()
    const currentProfile = this.#registry.getProfile(this.#active.id)
    return {
      ...info,
      name: currentProfile.name,
      settings: this.#active.application.queries.getSettings(),
    }
  }

  updateSettings(input: UpdateProfileSettingsInput): Promise<ProfileSettings> {
    this.#assertIdle()
    if (!this.#active || this.#active.id !== input.id) {
      throw new Error('Settings can only be changed for the active profile')
    }
    const settings = this.#active.application.commands.updateSettings(
      input.settings,
    )
    if (!Object.hasOwn(input.settings, 'watchedFolder'))
      return Promise.resolve(settings)
    return this.#restartWatchedFolder().then(() => settings)
  }

  getWatchedFolderStatus(): WatchedFolderStatus | null {
    this.#assertIdle()
    return this.#watchedFolderStatus
  }

  getActiveApplication(): ProfileApplication {
    this.#assertIdle()
    if (!this.#active) throw new Error('No profile is open')
    return this.#active.application
  }

  listBackups(): ProfileBackup[] {
    this.#assertIdle()
    if (!this.#active) throw new Error('No profile is open')
    return this.#active.application.queries.listBackups()
  }

  async restoreBackup(input: RestoreBackupInput): Promise<ActiveProfileInfo> {
    return this.#changeProfile(async () => {
      if (!this.#active) throw new Error('No profile is open')
      await this.#stopWatchedFolder()
      try {
        await this.#active.application.commands.restoreBackup(input)
        return this.getActive() as ActiveProfileInfo
      } finally {
        await this.#startWatchedFolder()
      }
    })
  }

  #assertIdle(): void {
    if (this.#shuttingDown) throw new Error('The application is shutting down')
    if (this.#changing) throw new Error('A profile operation is in progress')
  }

  async #changeProfile<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    this.#assertIdle()
    this.#changing = true
    try {
      const pending = operation()
      this.#pending = pending
      return await pending
    } finally {
      this.#changing = false
      this.#pending = null
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.#pending
    } catch {
      // The initiating IPC call reports failure; shutdown still closes the database.
    }
    this.#shuttingDown = true
    this.#shutdownProfileId = this.#active?.id ?? null
    await this.#closeActive()
  }

  async recoverFromFailedShutdown(): Promise<void> {
    if (!this.#shuttingDown) return
    const profileId = this.#shutdownProfileId
    this.#shuttingDown = false
    this.#shutdownProfileId = null
    if (profileId) await this.open(profileId)
  }

  close(): Promise<void> {
    return this.#changeProfile(() => this.#closeActive())
  }

  async #closeActive(): Promise<void> {
    await this.#stopWatchedFolder()
    await this.#active?.application.stopBackgroundWork()
    this.#active?.application.close()
    this.#active = null
  }

  #restartWatchedFolder(): Promise<void> {
    return this.#queueWatchedFolder(async () => {
      await this.#watchedFolder.stop()
      this.#setWatchedFolderStatus(null)
      const folder =
        this.#active?.application.queries.getSettings().watchedFolder
      if (folder) await this.#watchedFolder.start(folder)
    })
  }

  #startWatchedFolder(): Promise<void> {
    return this.#queueWatchedFolder(async () => {
      const folder =
        this.#active?.application.queries.getSettings().watchedFolder
      if (folder) await this.#watchedFolder.start(folder)
      else this.#setWatchedFolderStatus(null)
    })
  }

  #stopWatchedFolder(): Promise<void> {
    return this.#queueWatchedFolder(async () => {
      await this.#watchedFolder.stop()
      this.#setWatchedFolderStatus(null)
    })
  }

  #queueWatchedFolder(operation: () => Promise<void>): Promise<void> {
    const next = this.#watchedFolderOperation.then(operation, operation)
    this.#watchedFolderOperation = next.catch(() => {})
    return next
  }

  #setWatchedFolderStatus(status: WatchedFolderStatus | null): void {
    if (this.#watchedFolderStatus === status) return
    this.#watchedFolderStatus = status
    this.#options.onWatchedFolderStatusChanged?.(status)
  }

  #applicationOptions() {
    return {
      exchangeRateSource: this.#options.exchangeRateSource,
      onRateStatusChanged: this.#options.onRateStatusChanged,
      onPendingTransactionsChanged: this.#options.onPendingTransactionsChanged,
      onReceiptInboxChanged: this.#options.onReceiptInboxChanged,
      ocrEngine: this.#options.ocrEngine,
      logger: this.#options.logger,
      clock: this.#options.clock,
    }
  }
}
