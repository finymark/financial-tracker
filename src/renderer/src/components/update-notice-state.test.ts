import { expect, test } from 'vitest'
import {
  initialUpdateNoticeState,
  isReadyVisible,
  updateNoticeReducer,
} from './update-notice-state'

test('Later hides only the ready version that was dismissed', () => {
  let state = updateNoticeReducer(initialUpdateNoticeState, {
    type: 'main-state',
    source: 'push',
    state: { status: 'ready', version: '0.5.1' },
  })
  expect(isReadyVisible(state)).toBe(true)

  state = updateNoticeReducer(state, { type: 'later' })
  expect(isReadyVisible(state)).toBe(false)
  state = updateNoticeReducer(state, {
    type: 'main-state',
    source: 'push',
    state: { status: 'ready', version: '0.5.1' },
  })
  expect(isReadyVisible(state)).toBe(false)

  state = updateNoticeReducer(state, {
    type: 'main-state',
    source: 'push',
    state: { status: 'ready', version: '0.5.2' },
  })
  expect(isReadyVisible(state)).toBe(true)
})

test('push state wins over an earlier pull that resolves late', () => {
  let state = updateNoticeReducer(initialUpdateNoticeState, {
    type: 'main-state',
    source: 'pull',
    state: { status: 'downloading', percent: 10 },
  })
  state = updateNoticeReducer(state, {
    type: 'main-state',
    source: 'push',
    state: { status: 'ready', version: '0.5.1' },
  })
  state = updateNoticeReducer(state, {
    type: 'main-state',
    source: 'pull',
    state: { status: 'idle' },
  })

  expect(state.update).toEqual({ status: 'ready', version: '0.5.1' })
})

test('an install-error push leaves the ready card retryable', () => {
  let state = updateNoticeReducer(initialUpdateNoticeState, {
    type: 'main-state',
    source: 'push',
    state: { status: 'ready', version: '0.5.1' },
  })
  state = updateNoticeReducer(state, { type: 'restart' })
  expect(state.busy).toBe(true)

  state = updateNoticeReducer(state, {
    type: 'main-state',
    source: 'push',
    state: { status: 'ready', version: '0.5.1', installError: true },
  })
  expect(state.busy).toBe(false)
  expect(state.error).toBe(true)
  expect(isReadyVisible(state)).toBe(true)
})
