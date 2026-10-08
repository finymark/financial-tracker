export interface PhoneUploadStartInput {
  dialogId: string
  address?: string
}

export interface PhoneUploadStopInput {
  dialogId: string
}

export interface PhoneUploadNetworkInterface {
  interfaceName: string
  address: string
}

export interface PhoneUploadSessionInfo {
  available: true
  dialogId: string
  url: string
  qrDataUrl: string
  interfaces: PhoneUploadNetworkInterface[]
  selectedAddress: string
  expiresAt: number
  uploadedCount: number
}

export interface PhoneUploadUnavailable {
  available: false
  reason: 'no-private-network'
}

export type PhoneUploadStartResult =
  PhoneUploadSessionInfo | PhoneUploadUnavailable

export interface PhoneUploadReceivedEvent {
  dialogId: string
  uploadedCount: number
}
