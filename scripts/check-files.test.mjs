import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runGuard } from './check-files.mjs'

const cli = fileURLToPath(new URL('./check-files.mjs', import.meta.url))
let directory

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'file-guard-'))
})
afterEach(() => rmSync(directory, { recursive: true, force: true }))

function write(file, content) {
  mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
  writeFileSync(path.join(directory, file), content)
}
async function run(...files) {
  const diagnostics = []
  const status = await runGuard(files, {
    directory,
    report: (message) => diagnostics.push(message),
  })
  return { status, stderr: diagnostics.join('\n') }
}

const mailbox = ['synthetic', 'example.invalid'].join('@')
const home = ['C:', 'Users', 'synthetic', 'file.txt'].join('\\')
const token = ['ghp_', 'x'.repeat(36)].join('')

describe('file guard', () => {
  it.each([
    ['Windows home path', home, 'windows-home'],
    [
      'escaped Windows home path',
      home.replaceAll('\\', '\\\\'),
      'windows-home',
    ],
    [
      'forward-slash Windows home path',
      home.replaceAll('\\', '/'),
      'windows-home',
    ],
    [
      'Git Bash home path',
      ['/c', 'Users', 'synthetic'].join('/'),
      'windows-home',
    ],
    [
      'macOS home path',
      ['', 'Users', 'synthetic', 'file.txt'].join('/'),
      'windows-home',
    ],
    [
      'Linux home path',
      ['', 'home', 'synthetic', 'file.txt'].join('/'),
      'windows-home',
    ],
    ['GitHub token', token, 'secret'],
    [
      'fine-grained GitHub token',
      ['github_pat_', 'x'.repeat(80)].join(''),
      'secret',
    ],
    ['AWS access identifier', ['AKIA', 'X'.repeat(16)].join(''), 'secret'],
    ['private key', ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' '), 'secret'],
    ['API key assignment', ['api_key', 'synthetic'].join('='), 'secret'],
    [
      'quoted JSON API key',
      JSON.stringify({ ['api' + '_key']: 'synthetic' }),
      'secret',
    ],
    ['client secret', ['client_secret', 'synthetic'].join(' = '), 'secret'],
    ['password assignment', ['password', 'synthetic'].join('='), 'secret'],
    ['email address', mailbox, 'email'],
  ])(
    'blocks %s without printing its contents',
    async (_label, content, rule) => {
      write('sample.txt', content)
      const result = await run('sample.txt')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`sample.txt:1: ${rule}`)
      expect(result.stderr).not.toContain(content)
    },
  )

  it('accepts safe text and GitHub noreply addresses', async () => {
    write(
      'safe.txt',
      [
        'Safe text',
        ['123+synthetic', 'users.noreply.github.com'].join('@'),
        ['noreply', 'github.com'].join('@'),
      ].join('\n'),
    )
    expect((await run('safe.txt')).status).toBe(0)
  })

  it('does not exempt domains merely containing the GitHub noreply domain', async () => {
    write(
      'sample.txt',
      ['synthetic', 'users.noreply.github.com.example.invalid'].join('@'),
    )
    expect((await run('sample.txt')).status).toBe(1)
  })

  it('ignores upstream e-mail addresses in the generated lockfile only', async () => {
    write('package-lock.json', `{"deprecated": "contact ${mailbox}"}`)
    write('nested/package-lock.json', `{"deprecated": "contact ${mailbox}"}`)
    expect((await run('package-lock.json')).status).toBe(0)
    expect((await run('nested/package-lock.json')).status).toBe(1)
  })

  it('still flags secrets in the generated lockfile', async () => {
    write('package-lock.json', `{"resolved": "${token}"}`)
    expect((await run('package-lock.json')).stderr).toContain('secret')
  })

  it('does not mistake pinned npm package specifications for email addresses', async () => {
    write('sample.txt', 'npm@12.2.0')
    expect((await run('sample.txt')).status).toBe(0)
  })

  it.each(['node_modules/@tesseract.js-data/eng', "'!node_modules/@scope/**'"])(
    'does not mistake scoped npm path %s for an email address',
    async (value) => {
      write('sample.txt', value)
      expect((await run('sample.txt')).status).toBe(0)
    },
  )

  it.each([
    'png',
    'JPG',
    'jpeg',
    'gif',
    'webp',
    'bmp',
    'tif',
    'tiff',
    'pdf',
    'svg',
    'ico',
    'avif',
    'heic',
  ])('blocks a fixture image with extension %s', async (extension) => {
    write(`src/fixtures/sample.${extension}`, 'synthetic image placeholder')
    expect((await run(`src/fixtures/sample.${extension}`)).stderr).toContain(
      'fixture-image',
    )
  })

  it.each([
    'fixtures',
    'receipt-fixtures',
    'fixtures-private',
    'nested/test-fixtures',
  ])('blocks media under any %s folder', async (folder) => {
    const file = `${folder}/sample.pdf`
    write(file, '%PDF-1.7\nsynthetic\n')
    expect((await run(file)).stderr).toContain('fixture-image')
  })

  it('blocks a renamed image by its signature, but permits images outside fixtures', async () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])
    write('fixtures/sample.dat', image)
    write('assets/sample.png', image)
    expect((await run('fixtures/sample.dat')).status).toBe(1)
    expect((await run('assets/sample.png')).status).toBe(0)
  })

  it.each(['<<<<<<< HEAD', '=======', '>>>>>>> branch', '||||||| base'])(
    'blocks merge marker %s',
    async (marker) => {
      write('sample.txt', `safe\n${marker}\n`)
      expect((await run('sample.txt')).stderr).toContain(
        'sample.txt:2: merge-marker',
      )
    },
  )

  it('blocks invalid JSON and accepts valid JSON', async () => {
    write('bad.json', '{')
    write('good.json', '{"ok":true}')
    expect((await run('bad.json')).stderr).toContain('json: invalid JSON')
    expect((await run('good.json')).status).toBe(0)
  })

  it('enforces the decimal 1 MB boundary', async () => {
    write('limit.txt', Buffer.alloc(1_000_000, 32))
    write('large.txt', Buffer.alloc(1_000_001, 32))
    expect((await run('limit.txt')).status).toBe(0)
    expect((await run('large.txt')).stderr).toContain('file-size')
  })

  it('accepts multiple filenames, spaces, and deleted files from a diff', async () => {
    write('safe file.txt', 'safe')
    write('bad file.txt', mailbox)
    expect((await run('safe file.txt', 'deleted.txt')).status).toBe(0)
    expect((await run('safe file.txt', 'bad file.txt')).status).toBe(1)
  })

  it('allows only the reviewed file, rule, and content hash; changes revoke approval', async () => {
    write('sample.txt', mailbox)
    write('other.txt', mailbox)
    write(
      '.personal-data-allowlist.json',
      JSON.stringify([
        {
          file: 'sample.txt',
          rule: 'email',
          sha256: createHash('sha256').update(mailbox).digest('hex'),
          reason: 'Synthetic test of exact approval',
        },
      ]),
    )
    expect((await run('sample.txt')).status).toBe(0)
    expect((await run('other.txt')).status).toBe(1)
    write('sample.txt', `${mailbox}\n${token}`)
    expect((await run('sample.txt')).stderr).toContain('email')
    expect((await run('sample.txt')).stderr).toContain('secret')
  })

  it('rejects malformed allowlists and attempts to allow non-personal checks', async () => {
    write('sample.txt', 'safe')
    write('.personal-data-allowlist.json', '{')
    expect((await run('sample.txt')).status).toBe(2)
    write(
      '.personal-data-allowlist.json',
      JSON.stringify([
        {
          file: 'sample.txt',
          rule: 'merge-marker',
          sha256: '0'.repeat(64),
          reason: 'Not permitted',
        },
      ]),
    )
    expect((await run('sample.txt')).status).toBe(2)
  })

  it('requires a file list instead of silently scanning nothing', async () => {
    expect((await run()).status).toBe(2)
  })
})

describe('file guard CLI', () => {
  it.each([
    ['clean files', 0],
    ['findings', 1],
    ['missing file list', 2],
  ])('returns the expected exit code for %s', async (_label, status) => {
    write('safe file.txt', 'safe')
    write('bad file.txt', mailbox)
    const files = status === 2 ? [] : ['safe file.txt', 'deleted.txt']
    if (status === 1) files.push(path.join(directory, 'bad file.txt'))
    const result = await new Promise((resolve) => {
      execFile(
        process.execPath,
        [cli, '--', ...files],
        {
          cwd: directory,
          encoding: 'utf8',
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        },
        (error, stdout, stderr) =>
          resolve({ status: error?.code ?? 0, stdout, stderr }),
      )
    })

    expect(result.status).toBe(status)
    expect(result.stdout).toBe('')
    if (status === 0) expect(result.stderr).toBe('')
    if (status === 1) {
      expect(result.stderr).toContain('bad file.txt:1: email')
      expect(result.stderr).not.toContain(mailbox)
    }
    if (status === 2) expect(result.stderr).toContain('Usage:')
  })
})
