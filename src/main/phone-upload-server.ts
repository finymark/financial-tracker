import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { NetworkInterfaceInfo } from 'node:os'
import { basename } from 'node:path'
import type { ReceiptIntake, ReceiptSource } from '../shared/receipts'
import type { Language } from '../shared/settings'
import { detectAttachmentFileType } from './attachment-file-type'

export const PHONE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024
export const PHONE_UPLOAD_DURATION_MS = 10 * 60 * 1000

export type ReceiptIntakeHandler = (
  input: Extract<ReceiptIntake, { bytes: Uint8Array }>,
  source: Extract<ReceiptSource, 'phone'>,
) => Promise<unknown>

export interface PhoneUploadServerState {
  uploadedCount: number
  activeUploads: number
}

export interface PhoneUploadServerOptions {
  bindAddress: string
  language: Language
  intake: ReceiptIntakeHandler
  onUploaded?: (count: number) => void
  clock?: () => number
  setTimer?: (callback: () => void, milliseconds: number) => unknown
  clearTimer?: (timer: unknown) => void
  token?: string
  expiresAt?: number
  state?: PhoneUploadServerState
}

export interface PhoneUploadServerSession {
  readonly url: string
  readonly expiresAt: number
  stop(): Promise<void>
}

export interface PrivateIpv4Interface {
  interfaceName: string
  address: string
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some(
      (part, index) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255 ||
        String(part) !== address.split('.')[index],
    )
  )
    return false
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

export function privateIpv4Interfaces(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[] | undefined>,
): PrivateIpv4Interface[] {
  const found: PrivateIpv4Interface[] = []
  const seen = new Set<string>()
  for (const [interfaceName, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (
        address.family !== 'IPv4' ||
        address.internal ||
        !isPrivateIpv4(address.address) ||
        seen.has(address.address)
      )
        continue
      seen.add(address.address)
      found.push({ interfaceName, address: address.address })
    }
  }
  return found
}

const pageMessages: Record<
  Language,
  {
    title: string
    choose: string
    queued: string
    uploading: string
    uploaded: string
    failed: string
  }
> = {
  hu: {
    title: 'Blokk feltöltése telefonról',
    choose: 'Készíts vagy válassz fotókat',
    queued: 'Várakozik',
    uploading: 'Feltöltés…',
    uploaded: 'Feltöltve',
    failed: 'Nem sikerült',
  },
  en: {
    title: 'Upload receipt photos',
    choose: 'Take or choose photos',
    queued: 'Queued',
    uploading: 'Uploading…',
    uploaded: 'Uploaded',
    failed: 'Failed',
  },
  de: {
    title: 'Kassenbonfotos hochladen',
    choose: 'Fotos aufnehmen oder auswählen',
    queued: 'Wartet',
    uploading: 'Wird hochgeladen…',
    uploaded: 'Hochgeladen',
    failed: 'Fehlgeschlagen',
  },
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] as string,
  )
}

function uploadPage(language: Language, nonce: string): string {
  const message = pageMessages[language]
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(message.title)}</title>
  <style nonce="${nonce}">
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0 auto; max-width: 38rem; padding: 1.25rem; }
    h1 { font-size: 1.5rem; }
    input { box-sizing: border-box; font: inherit; max-width: 100%; padding: .75rem; width: 100%; }
    li { margin-block: .75rem; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(message.title)}</h1>
    <label>${escapeHtml(message.choose)}
      <input id="photos" type="file" accept="image/*" multiple>
    </label>
    <ul id="results" aria-live="polite"></ul>
  </main>
  <script nonce="${nonce}">
    const input = document.getElementById('photos');
    const results = document.getElementById('results');
    const labels = ${JSON.stringify(message)};
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      const rows = files.map((file) => {
        const row = document.createElement('li');
        row.textContent = file.name + ' — ' + labels.queued;
        results.append(row);
        return { file, row };
      });
      let next = 0;
      async function worker() {
        while (next < rows.length) {
          const current = rows[next++];
          current.row.textContent = current.file.name + ' — ' + labels.uploading;
          try {
            const response = await fetch(location.pathname + '/upload', {
              method: 'PUT',
              headers: {
                'Content-Type': current.file.type || 'application/octet-stream',
                'X-File-Name': encodeURIComponent(current.file.name),
              },
              body: current.file,
            });
            if (!response.ok) throw new Error(String(response.status));
            current.row.textContent = current.file.name + ' — ' + labels.uploaded;
          } catch {
            current.row.textContent = current.file.name + ' — ' + labels.failed;
          }
        }
      }
      await Promise.all([worker(), worker()]);
      input.value = '';
    });
  </script>
</body>
</html>`
}

function tokenMatches(candidate: string, expected: string): boolean {
  const candidateHash = createHash('sha256').update(candidate).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(candidateHash, expectedHash)
}

function requestRoute(
  request: IncomingMessage,
  expectedToken: string,
): 'page' | 'upload' | null {
  let pathname: string
  try {
    pathname = new URL(request.url ?? '', 'http://phone-upload.invalid')
      .pathname
  } catch {
    return null
  }
  const match = /^\/u\/([^/]+)(\/upload)?$/.exec(pathname)
  if (!match || !tokenMatches(match[1], expectedToken)) return null
  return match[2] ? 'upload' : 'page'
}

function fileName(request: IncomingMessage): string {
  const header = request.headers['x-file-name']
  if (typeof header !== 'string') return 'phone-photo.jpg'
  let decoded: string
  try {
    decoded = decodeURIComponent(header)
  } catch {
    return 'phone-photo.jpg'
  }
  const safe = basename(decoded.replaceAll('\\', '/'))
    .replace(/[\0-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 120)
  return safe && safe !== '.' && safe !== '..' ? safe : 'phone-photo.jpg'
}

function isImage(bytes: Buffer): boolean {
  const type = detectAttachmentFileType(bytes)
  return Boolean(type && type.mediaType !== 'application/pdf')
}

function respondJson(
  response: import('node:http').ServerResponse,
  status: number,
  value: object,
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function rejectRequest(
  request: IncomingMessage,
  response: import('node:http').ServerResponse,
  status: number,
  headers: Record<string, string> = {},
  json = false,
): void {
  response.shouldKeepAlive = false
  response.writeHead(status, {
    ...headers,
    Connection: 'close',
    ...(json
      ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        }
      : {}),
  })
  response.end(json ? JSON.stringify({ ok: false }) : undefined, () => {
    request.destroy()
  })
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

export async function startPhoneUploadServer(
  options: PhoneUploadServerOptions,
): Promise<PhoneUploadServerSession> {
  const clock = options.clock ?? Date.now
  const setTimer =
    options.setTimer ?? ((callback, delay) => setTimeout(callback, delay))
  const clearTimer =
    options.clearTimer ?? ((timer) => clearTimeout(timer as NodeJS.Timeout))
  const token = options.token ?? randomBytes(32).toString('base64url')
  const expiresAt = options.expiresAt ?? clock() + PHONE_UPLOAD_DURATION_MS
  const state = options.state ?? { uploadedCount: 0, activeUploads: 0 }
  const expirationTimer: { current?: unknown } = {}
  let stopping: Promise<void> | null = null

  const server = createServer((request, response) => {
    if (clock() >= expiresAt) {
      rejectRequest(request, response, 404)
      void stop()
      return
    }
    const route = requestRoute(request, token)
    if (!route) {
      rejectRequest(request, response, 404)
      return
    }
    if (route === 'page') {
      if (request.method !== 'GET') {
        rejectRequest(request, response, 405, { Allow: 'GET' })
        return
      }
      const nonce = randomBytes(18).toString('base64')
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(uploadPage(options.language, nonce))
      return
    }
    if (request.method !== 'POST' && request.method !== 'PUT') {
      rejectRequest(request, response, 405, { Allow: 'POST, PUT' })
      return
    }
    const contentLength = request.headers['content-length']
    if (
      typeof contentLength === 'string' &&
      /^\d+$/.test(contentLength) &&
      Number(contentLength) > PHONE_UPLOAD_MAX_BYTES
    ) {
      rejectRequest(request, response, 413, {}, true)
      return
    }
    if (
      state.activeUploads >= 2 ||
      state.uploadedCount + state.activeUploads >= 50
    ) {
      rejectRequest(request, response, 429, {}, true)
      return
    }
    state.activeUploads += 1

    const chunks: Buffer[] = []
    let byteCount = 0
    let rejected = false
    let released = false
    const release = () => {
      if (released) return
      released = true
      state.activeUploads -= 1
    }
    request.on('data', (chunk: Buffer) => {
      if (rejected) return
      if (byteCount + chunk.length > PHONE_UPLOAD_MAX_BYTES) {
        rejected = true
        request.removeAllListeners('data')
        release()
        rejectRequest(request, response, 413, {}, true)
        return
      }
      byteCount += chunk.length
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (rejected) return
      const bytes = Buffer.concat(chunks, byteCount)
      if (!isImage(bytes)) {
        release()
        rejectRequest(request, response, 415, {}, true)
        return
      }
      void Promise.resolve()
        .then(() => options.intake({ bytes, name: fileName(request) }, 'phone'))
        .then(
          () => {
            state.uploadedCount += 1
            release()
            try {
              options.onUploaded?.(state.uploadedCount)
            } catch {
              // Renderer notification failures must not turn a stored receipt into
              // an upload failure that encourages the phone to send a duplicate.
            }
            respondJson(response, 200, { ok: true })
          },
          () => {
            release()
            respondJson(response, 500, { ok: false })
          },
        )
    })
    request.on('error', () => {
      rejected = true
      release()
      if (!response.headersSent) response.writeHead(400).end()
    })
    request.on('aborted', release)
  })
  server.headersTimeout = 30_000
  server.requestTimeout = 300_000

  const stop = (): Promise<void> => {
    if (stopping) return stopping
    if (expirationTimer.current !== undefined)
      clearTimer(expirationTimer.current)
    stopping = closeServer(server)
    return stopping
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, options.bindAddress)
  })
  expirationTimer.current = setTimer(
    () => void stop(),
    Math.max(0, expiresAt - clock()),
  )
  const address = server.address() as AddressInfo
  return {
    url: `http://${options.bindAddress}:${address.port}/u/${token}`,
    expiresAt,
    stop,
  }
}
