import type { AppBridge } from '../../shared/ipc'

declare global {
  interface Window {
    app: AppBridge
  }
}
