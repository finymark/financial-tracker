import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  ProfileRegistrySnapshot,
  ProfileSummary,
} from '../../shared/profiles'

const REGISTRY_VERSION = 1
const RENAME_RETRY_DELAYS = [10, 20, 40, 80, 160]
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface StoredRegistry extends ProfileRegistrySnapshot {
  version: typeof REGISTRY_VERSION
}

export interface ProfilePaths {
  profileDirectory: string
  databasePath: string
  dataDirectory: string
  backupDirectory: string
  preMigrationBackupDirectory: string
}

export interface ProfileRegistryOptions {
  userDataDirectory: string
  clock?: () => Date
  createId?: () => string
  rename?: typeof renameSync
  wait?: (milliseconds: number) => void
}

function validateName(name: string): string {
  const normalized = name.trim()
  if (normalized.length === 0 || normalized.length > 100) {
    throw new Error('Profile name must contain between 1 and 100 characters')
  }
  return normalized
}

function isProfileSummary(value: unknown): value is ProfileSummary {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    UUID_PATTERN.test(candidate.id) &&
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt))
  )
}

function parseRegistry(contents: string): StoredRegistry {
  const parsed: unknown = JSON.parse(contents)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Profile registry is not an object')
  }
  const candidate = parsed as Record<string, unknown>
  if (
    candidate.version !== REGISTRY_VERSION ||
    !Array.isArray(candidate.profiles) ||
    !candidate.profiles.every(isProfileSummary) ||
    !(
      candidate.lastUsedProfileId === null ||
      typeof candidate.lastUsedProfileId === 'string'
    )
  ) {
    throw new Error('Profile registry has an unsupported or invalid format')
  }
  const profiles = candidate.profiles
  const ids = new Set(profiles.map((profile) => profile.id))
  if (
    ids.size !== profiles.length ||
    (candidate.lastUsedProfileId !== null &&
      !ids.has(candidate.lastUsedProfileId))
  ) {
    throw new Error('Profile registry contains inconsistent profile ids')
  }
  return {
    version: REGISTRY_VERSION,
    profiles,
    lastUsedProfileId: candidate.lastUsedProfileId,
  }
}

export class ProfileRegistry {
  readonly #registryPath: string
  readonly #profilesDirectory: string
  readonly #clock: () => Date
  readonly #createId: () => string
  readonly #rename: typeof renameSync
  readonly #wait: (milliseconds: number) => void

  constructor(options: ProfileRegistryOptions) {
    this.#registryPath = join(options.userDataDirectory, 'profiles.json')
    this.#profilesDirectory = join(options.userDataDirectory, 'profiles')
    this.#clock = options.clock ?? (() => new Date())
    this.#createId = options.createId ?? randomUUID
    this.#rename = options.rename ?? renameSync
    this.#wait =
      options.wait ??
      ((milliseconds) => {
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          milliseconds,
        )
      })
    mkdirSync(this.#profilesDirectory, { recursive: true })
    if (!existsSync(this.#registryPath)) this.#write(this.#emptyRegistry())
    this.#read()
  }

  listProfiles(): ProfileSummary[] {
    return this.#read().profiles.map((profile) => ({ ...profile }))
  }

  getLastUsedProfileId(): string | null {
    return this.#read().lastUsedProfileId
  }

  getProfile(id: string): ProfileSummary {
    const profile = this.#read().profiles.find(
      (candidate) => candidate.id === id,
    )
    if (!profile) throw new Error('Profile not found')
    return { ...profile }
  }

  createProfile(name: string): ProfileSummary {
    const registry = this.#read()
    const id = this.#createId()
    if (
      !UUID_PATTERN.test(id) ||
      registry.profiles.some((item) => item.id === id)
    ) {
      throw new Error(
        'Profile id generator returned an invalid or duplicate UUID',
      )
    }
    const profile: ProfileSummary = {
      id,
      name: validateName(name),
      createdAt: this.#clock().toISOString(),
    }
    const paths = this.getProfilePaths(id)
    mkdirSync(paths.dataDirectory, { recursive: true })
    mkdirSync(paths.preMigrationBackupDirectory, { recursive: true })
    try {
      this.#write({
        ...registry,
        profiles: [...registry.profiles, profile],
      })
    } catch (error) {
      rmSync(paths.profileDirectory, { recursive: true, force: true })
      throw error
    }
    return { ...profile }
  }

  renameProfile(id: string, name: string): ProfileSummary {
    const registry = this.#read()
    const index = registry.profiles.findIndex((profile) => profile.id === id)
    if (index === -1) throw new Error('Profile not found')
    const renamed = { ...registry.profiles[index], name: validateName(name) }
    const profiles = [...registry.profiles]
    profiles[index] = renamed
    this.#write({ ...registry, profiles })
    return { ...renamed }
  }

  deleteProfile(id: string, confirmation: string): void {
    const registry = this.#read()
    const profile = registry.profiles.find((candidate) => candidate.id === id)
    if (!profile) throw new Error('Profile not found')
    if (confirmation !== profile.name) {
      throw new Error('Profile deletion confirmation does not match')
    }
    const profiles = registry.profiles.filter(
      (candidate) => candidate.id !== id,
    )
    this.#write({
      ...registry,
      profiles,
      lastUsedProfileId:
        registry.lastUsedProfileId === id ? null : registry.lastUsedProfileId,
    })
    try {
      rmSync(this.getProfilePaths(id).profileDirectory, {
        recursive: true,
        force: true,
      })
    } catch (error) {
      this.#write(registry)
      throw error
    }
  }

  rememberLastUsed(id: string): void {
    const registry = this.#read()
    if (!registry.profiles.some((profile) => profile.id === id)) {
      throw new Error('Profile not found')
    }
    this.#write({ ...registry, lastUsedProfileId: id })
  }

  getProfilePaths(id: string): ProfilePaths {
    if (!UUID_PATTERN.test(id)) throw new Error('Invalid profile id')
    const profileDirectory = join(this.#profilesDirectory, id)
    return {
      profileDirectory,
      databasePath: join(profileDirectory, 'profile.sqlite'),
      dataDirectory: join(profileDirectory, 'data'),
      backupDirectory: join(profileDirectory, 'backups'),
      preMigrationBackupDirectory: join(
        profileDirectory,
        'backups',
        'pre-migration',
      ),
    }
  }

  #emptyRegistry(): StoredRegistry {
    return { version: REGISTRY_VERSION, profiles: [], lastUsedProfileId: null }
  }

  #read(): StoredRegistry {
    try {
      return parseRegistry(readFileSync(this.#registryPath, 'utf8'))
    } catch (error) {
      throw new Error('Could not read the profile registry', { cause: error })
    }
  }

  #write(registry: StoredRegistry): void {
    mkdirSync(dirname(this.#registryPath), { recursive: true })
    const temporaryPath = `${this.#registryPath}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'w',
    })
    // Windows indexers/antivirus can briefly lock the destination. Keep the
    // original intact and retry only the atomic replace, for at most 310 ms.
    for (let attempt = 0; ; attempt += 1) {
      try {
        this.#rename(temporaryPath, this.#registryPath)
        return
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | null)?.code
        const delay = RENAME_RETRY_DELAYS[attempt]
        if (delay === undefined || !RETRYABLE_RENAME_CODES.has(code ?? '')) {
          throw error
        }
        this.#wait(delay)
      }
    }
  }
}
