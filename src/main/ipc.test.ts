import type { IpcMain } from 'electron'
import { beforeEach, expect, test, vi } from 'vitest'
import { registerIpcHandler } from './ipc'

beforeEach(() => {
  process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
})

test('IPC handlers accept only the application renderer origin', async () => {
  const handle = vi.fn()
  const implementation = vi.fn(() => 'ok')
  registerIpcHandler(
    { handle } as unknown as IpcMain,
    'test:channel',
    implementation,
  )
  const handler = handle.mock.calls[0][1]
  expect(
    handler({ senderFrame: { url: 'http://localhost:5173/index.html' } }),
  ).toBe('ok')
  expect(() =>
    handler({ senderFrame: { url: 'https://example.invalid/' } }),
  ).toThrow('IPC sender')
  expect(() => handler({ senderFrame: null })).toThrow('IPC sender')
  expect(implementation).toHaveBeenCalledTimes(1)
})
