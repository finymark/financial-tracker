import type {
  ProfileBackup,
  ProfileInfo,
  RestoreBackupInput,
  ProfileRegistrySnapshot,
  ProfileSummary,
} from '../../shared/profiles'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

export class ProfileController {
  readonly #registry: ProfileRegistry
  #changing = false
  #shuttingDown = false
  #pending: Promise<unknown> | null = null
  #active: { id: string; application: ProfileApplication } | null = null

  constructor(registry: ProfileRegistry) {
    this.#registry = registry
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
        })
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

  delete(id: string, confirmation: string): void {
    this.#assertIdle()
    if (
      this.#active?.id === id &&
      this.#registry.getProfile(id).name !== confirmation
    ) {
      throw new Error('Profile deletion confirmation does not match')
    }
    if (this.#active?.id === id) this.close()
    this.#registry.deleteProfile(id, confirmation)
  }

  async open(id: string): Promise<ProfileInfo> {
    return this.#changeProfile(async () => {
      const profile = this.#registry.getProfile(id)
      const application = await openProfileApplication({
        profile,
        paths: this.#registry.getProfilePaths(id),
      })
      try {
        this.#registry.rememberLastUsed(id)
      } catch (error) {
        application.close()
        throw error
      }
      this.#closeActive()
      this.#active = { id, application }
      return this.getActive() as ProfileInfo
    })
  }

  getActive(): ProfileInfo | null {
    if (!this.#active) return null
    const info = this.#active.application.queries.getProfileInfo()
    const currentProfile = this.#registry.getProfile(this.#active.id)
    return { ...info, name: currentProfile.name }
  }

  listBackups(): ProfileBackup[] {
    this.#assertIdle()
    if (!this.#active) throw new Error('No profile is open')
    return this.#active.application.queries.listBackups()
  }

  async restoreBackup(input: RestoreBackupInput): Promise<ProfileInfo> {
    return this.#changeProfile(async () => {
      if (!this.#active) throw new Error('No profile is open')
      await this.#active.application.commands.restoreBackup(input)
      return this.getActive() as ProfileInfo
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
    this.#shuttingDown = true
    try {
      await this.#pending
    } catch {
      // The initiating IPC call reports failure; shutdown still closes the database.
    }
    this.#closeActive()
  }

  close(): void {
    this.#assertIdle()
    this.#closeActive()
  }

  #closeActive(): void {
    this.#active?.application.close()
    this.#active = null
  }
}
