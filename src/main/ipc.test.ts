import type { IpcMain } from 'electron'
import { beforeEach, expect, test, vi } from 'vitest'
import { configureTrustedIpcWebContents, registerIpcHandler } from './ipc'

beforeEach(() => configureTrustedIpcWebContents(() => []))

test('IPC handlers accept exactly the main frames of the two app windows', async () => {
  const mainFrame = { url: 'http://localhost:5173/' }
  const quickAddFrame = { url: 'http://localhost:5173/?view=quick-add' }
  const mainContents = { mainFrame }
  const quickAddContents = { mainFrame: quickAddFrame }
  configureTrustedIpcWebContents(() => [mainContents, quickAddContents])
  const handle = vi.fn()
  const implementation = vi.fn(() => 'ok')
  registerIpcHandler(
    { handle } as unknown as IpcMain,
    'test:channel',
    implementation,
  )
  const handler = handle.mock.calls[0][1]
  expect(handler({ sender: mainContents, senderFrame: mainFrame })).toBe('ok')
  expect(
    handler({ sender: quickAddContents, senderFrame: quickAddFrame }),
  ).toBe('ok')
  expect(() =>
    handler({ sender: mainContents, senderFrame: { ...mainFrame } }),
  ).toThrow('IPC sender')
  expect(() =>
    handler({
      sender: { mainFrame: { url: 'http://localhost:5173/' } },
      senderFrame: mainFrame,
    }),
  ).toThrow('IPC sender')
  expect(() => handler({ senderFrame: null })).toThrow('IPC sender')
  expect(implementation).toHaveBeenCalledTimes(2)
})
