import { request } from 'node:http'
import { expect, test, vi } from 'vitest'
import {
  PHONE_UPLOAD_DURATION_MS,
  PHONE_UPLOAD_MAX_BYTES,
  privateIpv4Interfaces,
  startPhoneUploadServer,
} from './phone-upload-server'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03])

function send(
  url: string,
  options: {
    method?: string
    body?: Buffer
    headers?: Record<string, string>
  } = {},
): Promise<{
  status: number
  body: Buffer
  headers: Record<string, string | string[] | undefined>
}> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const outgoing = request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks),
            headers: response.headers,
          }),
        )
      },
    )
    outgoing.on('error', reject)
    outgoing.end(options.body)
  })
}

test('serves the upload page and sends an image to the injected receipt intake', async () => {
  const received: Array<{ bytes: Buffer; name: string; source: string }> = []
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake: async (input, source) => {
      received.push({ ...input, source })
      return undefined
    },
  })

  try {
    const page = await send(session.url)
    expect(page.status).toBe(200)
    expect(page.body.toString('utf8')).toContain('Upload receipt photos')
    expect(page.headers['content-security-policy']).toContain(
      "default-src 'none'",
    )

    const upload = await send(`${session.url}/upload`, {
      method: 'PUT',
      body: JPEG,
      headers: {
        'content-type': 'image/jpeg',
        'x-file-name': encodeURIComponent('../camera/receipt.jpg'),
      },
    })
    expect(upload.status).toBe(200)
    expect(JSON.parse(upload.body.toString('utf8'))).toEqual({ ok: true })
    expect(received).toEqual([
      { bytes: JPEG, name: 'receipt.jpg', source: 'phone' },
    ])
  } finally {
    await session.stop()
  }
})

test('hides missing, wrong and expired tokens with 404 responses', async () => {
  let now = 1_000
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake: vi.fn(),
    clock: () => now,
  })
  const base = new URL(session.url)

  try {
    expect((await send(`${base.origin}/`)).status).toBe(404)
    expect((await send(`${base.origin}/u/wrong-token`)).status).toBe(404)
    expect(
      (await send(`${base.origin}/u/wrong-token/upload`, { method: 'PUT' }))
        .status,
    ).toBe(404)
    now += PHONE_UPLOAD_DURATION_MS
    expect((await send(session.url)).status).toBe(404)
  } finally {
    await session.stop()
  }
})

test('returns 405 for unsupported methods on token routes', async () => {
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake: vi.fn(),
  })
  try {
    expect((await send(session.url, { method: 'POST' })).status).toBe(405)
    expect((await send(`${session.url}/upload`)).status).toBe(405)
  } finally {
    await session.stop()
  }
})

test('rejects a non-image by magic bytes without calling intake', async () => {
  const intake = vi.fn()
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'de',
    intake,
  })
  try {
    const response = await send(`${session.url}/upload`, {
      method: 'POST',
      body: Buffer.from('not an image'),
      headers: { 'x-file-name': encodeURIComponent('not-image.jpg') },
    })
    expect(response.status).toBe(415)
    expect(intake).not.toHaveBeenCalled()
  } finally {
    await session.stop()
  }
})

test('rejects a body over 25 MB as soon as the limit is crossed', async () => {
  const intake = vi.fn()
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'hu',
    intake,
  })
  try {
    const response = await send(`${session.url}/upload`, {
      method: 'PUT',
      body: Buffer.alloc(PHONE_UPLOAD_MAX_BYTES + 1, 1),
    })
    expect(response.status).toBe(413)
    expect(intake).not.toHaveBeenCalled()
  } finally {
    await session.stop()
  }
})

test('accepts at most 50 files in one session', async () => {
  const intake = vi.fn(async () => undefined)
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake,
  })
  try {
    for (let index = 0; index < 50; index += 1) {
      expect(
        (
          await send(`${session.url}/upload`, {
            method: 'PUT',
            body: JPEG,
          })
        ).status,
      ).toBe(200)
    }
    expect(
      (
        await send(`${session.url}/upload`, {
          method: 'PUT',
          body: JPEG,
        })
      ).status,
    ).toBe(429)
    expect(intake).toHaveBeenCalledTimes(50)
  } finally {
    await session.stop()
  }
})

test('accepts at most two concurrent uploads', async () => {
  let finishIntake: (() => void) | undefined
  const intakeFinished = new Promise<void>((resolve) => {
    finishIntake = resolve
  })
  const intake = vi.fn(() => intakeFinished)
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake,
  })
  try {
    const first = send(`${session.url}/upload`, {
      method: 'PUT',
      body: JPEG,
    })
    const second = send(`${session.url}/upload`, {
      method: 'PUT',
      body: JPEG,
    })
    await vi.waitFor(() => expect(intake).toHaveBeenCalledTimes(2))
    const third = await send(`${session.url}/upload`, {
      method: 'PUT',
      body: JPEG,
    })
    expect(third.status).toBe(429)
    finishIntake?.()
    expect((await first).status).toBe(200)
    expect((await second).status).toBe(200)
  } finally {
    finishIntake?.()
    await session.stop()
  }
})

test('stops accepting connections when stopped and after ten minutes', async () => {
  let now = 10_000
  let timeout: (() => void) | undefined
  const session = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake: vi.fn(),
    clock: () => now,
    setTimer: (callback, delay) => {
      expect(delay).toBe(PHONE_UPLOAD_DURATION_MS)
      timeout = callback
      return callback
    },
    clearTimer: () => {},
  })
  expect((await send(session.url)).status).toBe(200)
  now += PHONE_UPLOAD_DURATION_MS
  timeout?.()
  await session.stop()
  await expect(send(session.url)).rejects.toThrow()

  const stopped = await startPhoneUploadServer({
    bindAddress: '127.0.0.1',
    language: 'en',
    intake: vi.fn(),
  })
  await stopped.stop()
  await expect(send(stopped.url)).rejects.toThrow()
})

test('finds only non-internal private IPv4 interface addresses', () => {
  expect(
    privateIpv4Interfaces({
      Ethernet: [
        {
          address: '192.168.1.20',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '192.168.1.20/24',
        },
        {
          address: '169.254.1.2',
          netmask: '255.255.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '169.254.1.2/16',
        },
      ],
      WiFi: [
        {
          address: '172.20.4.5',
          netmask: '255.255.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '172.20.4.5/16',
        },
        {
          address: '10.0.0.8',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '10.0.0.8/8',
        },
      ],
      Loopback: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
    }),
  ).toEqual([
    { interfaceName: 'Ethernet', address: '192.168.1.20' },
    { interfaceName: 'WiFi', address: '172.20.4.5' },
  ])
})
