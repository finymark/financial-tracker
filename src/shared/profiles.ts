export interface ProfileSummary {
  id: string
  name: string
  createdAt: string
}

export interface ProfileRegistrySnapshot {
  profiles: ProfileSummary[]
  lastUsedProfileId: string | null
}

export interface ProfileInfo extends ProfileSummary {
  schemaVersion: number
}

export interface CreateProfileInput {
  name: string
}

export interface ProfileIdInput {
  id: string
}

export interface RenameProfileInput extends ProfileIdInput {
  name: string
}

export interface DeleteProfileInput extends ProfileIdInput {
  confirmation: string
}

export interface ProfileBackup {
  id: string
  createdAt: string
}

export interface RestoreBackupInput {
  backupId: string
  confirmed: boolean
}
