import type { UpdateState } from '../../../shared/ipc'

export interface UpdateNoticeState {
  update: UpdateState
  hiddenReadyVersion: string | null
  receivedPush: boolean
  busy: boolean
  error: boolean
}

export type UpdateNoticeAction =
  | {
      type: 'main-state'
      source: 'pull' | 'push'
      state: UpdateState
    }
  | { type: 'later' }
  | { type: 'restart' }
  | { type: 'restart-rejected' }

export const initialUpdateNoticeState: UpdateNoticeState = {
  update: { status: 'idle' },
  hiddenReadyVersion: null,
  receivedPush: false,
  busy: false,
  error: false,
}

export function updateNoticeReducer(
  current: UpdateNoticeState,
  action: UpdateNoticeAction,
): UpdateNoticeState {
  if (action.type === 'main-state') {
    if (action.source === 'pull' && current.receivedPush) return current
    const installError =
      action.state.status === 'ready' && action.state.installError === true
    return {
      ...current,
      update: action.state,
      receivedPush: current.receivedPush || action.source === 'push',
      busy: installError ? false : current.busy,
      error: installError,
    }
  }
  if (action.type === 'later') {
    return {
      ...current,
      hiddenReadyVersion:
        current.update.status === 'ready'
          ? current.update.version
          : current.hiddenReadyVersion,
      error: false,
    }
  }
  if (action.type === 'restart') return { ...current, busy: true, error: false }
  return { ...current, busy: false, error: true }
}

export function isReadyVisible(state: UpdateNoticeState): boolean {
  return (
    state.update.status === 'ready' &&
    state.update.version !== state.hiddenReadyVersion
  )
}
