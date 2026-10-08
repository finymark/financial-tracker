import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
function run(...files) {
  return spawnSync(process.execPath, [cli, '--', ...files], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
}

const mailbox = ['synthetic', 'example.invalid'].join('@')
const home = ['C:', 'Users', 'synthetic', 'file.txt'].join('\\')
const token = ['ghp_', 'x'.repeat(36)].join('')

describe('file guard CLI', () => {
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
  ])('blocks %s without printing its contents', (_label, content, rule) => {
    write('sample.txt', content)
    const result = run('sample.txt')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`sample.txt:1: ${rule}`)
    expect(result.stderr).not.toContain(content)
  })

  it('accepts safe text and GitHub noreply addresses', () => {
    write(
      'safe.txt',
      [
        'Safe text',
        ['123+synthetic', 'users.noreply.github.com'].join('@'),
        ['noreply', 'github.com'].join('@'),
      ].join('\n'),
    )
    expect(run('safe.txt').status).toBe(0)
  })

  it('does not exempt domains merely containing the GitHub noreply domain', () => {
    write(
      'sample.txt',
      ['synthetic', 'users.noreply.github.com.example.invalid'].join('@'),
    )
    expect(run('sample.txt').status).toBe(1)
  })

  it('does not mistake pinned npm package specifications for email addresses', () => {
    write('sample.txt', 'npm@12.2.0')
    expect(run('sample.txt').status).toBe(0)
  })

  it.each([
    'png',
    'JPG',
    'gif',
    'webp',
    'bmp',
    'tiff',
    'svg',
    'ico',
    'avif',
    'heic',
  ])('blocks a fixture image with extension %s', (extension) => {
    write(`src/fixtures/sample.${extension}`, 'synthetic image placeholder')
    expect(run(`src/fixtures/sample.${extension}`).stderr).toContain(
      'fixture-image',
    )
  })

  it('blocks a renamed image by its signature, but permits images outside fixtures', () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])
    write('fixtures/sample.dat', image)
    write('assets/sample.png', image)
    expect(run('fixtures/sample.dat').status).toBe(1)
    expect(run('assets/sample.png').status).toBe(0)
  })

  it.each(['<<<<<<< HEAD', '=======', '>>>>>>> branch', '||||||| base'])(
    'blocks merge marker %s',
    (marker) => {
      write('sample.txt', `safe\n${marker}\n`)
      expect(run('sample.txt').stderr).toContain('sample.txt:2: merge-marker')
    },
  )

  it('blocks invalid JSON and accepts valid JSON', () => {
    write('bad.json', '{')
    write('good.json', '{"ok":true}')
    expect(run('bad.json').stderr).toContain('json: invalid JSON')
    expect(run('good.json').status).toBe(0)
  })

  it('enforces the decimal 1 MB boundary', () => {
    write('limit.txt', Buffer.alloc(1_000_000, 32))
    write('large.txt', Buffer.alloc(1_000_001, 32))
    expect(run('limit.txt').status).toBe(0)
    expect(run('large.txt').stderr).toContain('file-size')
  })

  it('accepts multiple filenames, spaces, and deleted files from a diff', () => {
    write('safe file.txt', 'safe')
    write('bad file.txt', mailbox)
    expect(run('safe file.txt', 'deleted.txt').status).toBe(0)
    expect(run('safe file.txt', 'bad file.txt').status).toBe(1)
  })

  it('allows only the reviewed file, rule, and content hash; changes revoke approval', () => {
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
    expect(run('sample.txt').status).toBe(0)
    expect(run('other.txt').status).toBe(1)
    write('sample.txt', `${mailbox}\n${token}`)
    expect(run('sample.txt').stderr).toContain('email')
    expect(run('sample.txt').stderr).toContain('secret')
  })

  it('rejects malformed allowlists and attempts to allow non-personal checks', () => {
    write('sample.txt', 'safe')
    write('.personal-data-allowlist.json', '{')
    expect(run('sample.txt').status).toBe(2)
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
    expect(run('sample.txt').status).toBe(2)
  })

  it('requires a file list instead of silently scanning nothing', () => {
    expect(run().status).toBe(2)
  })
})
