import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const personalRules = ['windows-home', 'secret', 'email', 'fixture-image']
const patterns = [
  [
    'windows-home',
    /(?:[a-z]:[\\/]+Users[\\/]+|\/[a-z]\/Users\/|\/Users\/|\/home\/)[^\\/\s"'<>]+/gi,
  ],
  [
    'secret',
    /\b(?:gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b|-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----|["']?\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|password)["']?\s*[:=]\s*["']?[^\s"'`,;}{]+/gi,
  ],
  [
    'email',
    /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,63}\b/gi,
  ],
]
const imageExtension =
  /\.(?:png|jpe?g|gif|webp|bmp|tiff?|pdf|svg|ico|avif|hei[cf]|dng|raw|psd)$/i
const mergeMarker = /^(?:<{7,}|={7,}|>{7,}|\|{7,})(?:\s.*)?$/m
const digest = (content) => createHash('sha256').update(content).digest('hex')

async function readAllowlist(file) {
  let content
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  let entries
  try {
    entries = JSON.parse(content)
  } catch {
    throw new Error('Invalid allowlist: expected a JSON array')
  }
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        !entry ||
        typeof entry.file !== 'string' ||
        !entry.file ||
        entry.file.includes('\\') ||
        entry.file.split('/').includes('..') ||
        path.isAbsolute(entry.file) ||
        !personalRules.includes(entry.rule) ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        typeof entry.reason !== 'string' ||
        !entry.reason.trim(),
    )
  ) {
    throw new Error(
      'Invalid allowlist: expected file, personal-data rule, sha256, and reason',
    )
  }
  return entries
}

function isImage(content) {
  const header = content.subarray(0, 512).toString('latin1')
  return (
    /^(?:\x89PNG\r\n\x1a\n|\xff\xd8\xff|GIF8[79]a|BM|II\x2a\x00|MM\x00\x2a|\x00\x00\x01\x00|8BPS)/.test(
      header,
    ) ||
    /^RIFF[\s\S]{4}WEBP/.test(header) ||
    /^[\s\S]{4}ftyp(?:avif|avis|heic|heix|hevc|hevx|mif1|msf1)/.test(header) ||
    /<svg(?:\s|>)/i.test(header) ||
    /^%PDF-/i.test(header)
  )
}

async function check(file, allowlist, directory) {
  const absolutePath = path.resolve(directory, file)
  const name = path.relative(directory, absolutePath).split(path.sep).join('/')
  let info
  try {
    info = await stat(absolutePath)
  } catch (error) {
    // Diff callers can include deletions; there is no remaining content to scan.
    if (error.code === 'ENOENT') return []
    throw error
  }
  if (!info.isFile()) return []
  if (info.size > 1_000_000)
    return [`${name}: file-size: exceeds 1 MB (1,000,000 bytes)`]
  const content = await readFile(absolutePath)
  const findings = []
  const report = (rule, line) => {
    if (
      personalRules.includes(rule) &&
      allowlist.some(
        (entry) =>
          entry.file === name &&
          entry.rule === rule &&
          entry.sha256 === digest(content),
      )
    ) {
      return
    }
    findings.push(`${name}${line ? `:${line}` : ''}: ${rule}`)
  }
  if (
    /(?:^|\/)[^/]*fixtures[^/]*\//i.test(name) &&
    (imageExtension.test(name) || isImage(content))
  ) {
    report('fixture-image')
  }
  const text = content.toString('utf8')
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (mergeMarker.test(line)) report('merge-marker', index + 1)
    for (const [rule, pattern] of patterns) {
      // The lockfile is generated from the registry and carries upstream
      // maintainers' contact addresses in deprecation notices.
      if (rule === 'email' && name === 'package-lock.json') continue
      const matches = [...line.matchAll(pattern)]
      if (
        matches.some(
          ([match]) =>
            rule !== 'email' ||
            !/^(?:[^@]+@users\.noreply\.github\.com|noreply@github\.com)$/i.test(
              match,
            ),
        )
      ) {
        report(rule, index + 1)
      }
    }
  }
  if (/\.json$/i.test(name)) {
    try {
      JSON.parse(text)
    } catch {
      report('json: invalid JSON')
    }
  }
  return findings
}

export async function runGuard(
  files,
  { directory = process.cwd(), report = console.error } = {},
) {
  if (!files.length) {
    report('Usage: node scripts/check-files.mjs [--] <file> [file ...]')
    return 2
  }
  try {
    const allowlist = await readAllowlist(
      path.resolve(directory, '.personal-data-allowlist.json'),
    )
    const findings = (
      await Promise.all(files.map((file) => check(file, allowlist, directory)))
    ).flat()
    if (findings.length) {
      report(findings.join('\n'))
      report(
        'File guard failed. Remove the finding or review a personal-data allowlist entry.',
      )
      return 1
    }
    return 0
  } catch (error) {
    report(`File guard could not run: ${error.code ?? error.message}`)
    return 2
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await runGuard(
    process.argv.slice(2).filter((argument) => argument !== '--'),
  )
}
