import type {
  ProfileInfo,
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
  }

  rename(id: string, name: string): ProfileSummary {
    return this.#registry.renameProfile(id, name)
  }

  delete(id: string, confirmation: string): void {
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
    this.close()
    this.#active = { id, application }
    return this.getActive() as ProfileInfo
  }

  getActive(): ProfileInfo | null {
    if (!this.#active) return null
    const info = this.#active.application.queries.getProfileInfo()
    const currentProfile = this.#registry.getProfile(this.#active.id)
    return { ...info, name: currentProfile.name }
  }

  close(): void {
    this.#active?.application.close()
    this.#active = null
  }
}
