import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const personalRules = ['windows-home', 'secret', 'email', 'fixture-image']
const patterns = [
  [
    'windows-home',
    /(?:[a-z]:[\\/]+Users[\\/]+|\/[a-z]\/Users\/)[^\\/\s"'<>]+/gi,
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
  /\.(?:png|jpe?g|gif|webp|bmp|tiff?|svg|ico|avif|hei[cf]|dng|raw|psd)$/i
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
    /<svg(?:\s|>)/i.test(header)
  )
}

async function check(file, allowlist) {
  const name = path
    .relative(process.cwd(), path.resolve(file))
    .split(path.sep)
    .join('/')
  let info
  try {
    info = await stat(file)
  } catch (error) {
    // Diff callers can include deletions; there is no remaining content to scan.
    if (error.code === 'ENOENT') return []
    throw error
  }
  if (!info.isFile()) return []
  if (info.size > 1_000_000)
    return [`${name}: file-size: exceeds 1 MB (1,000,000 bytes)`]
  const content = await readFile(file)
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
    /(?:^|\/)fixtures\//i.test(name) &&
    (imageExtension.test(name) || isImage(content))
  ) {
    report('fixture-image')
  }
  const text = content.toString('utf8')
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (mergeMarker.test(line)) report('merge-marker', index + 1)
    for (const [rule, pattern] of patterns) {
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

async function main() {
  const files = process.argv.slice(2).filter((argument) => argument !== '--')
  if (!files.length) {
    console.error('Usage: node scripts/check-files.mjs [--] <file> [file ...]')
    process.exitCode = 2
    return
  }
  const allowlist = await readAllowlist('.personal-data-allowlist.json')
  const findings = (
    await Promise.all(files.map((file) => check(file, allowlist)))
  ).flat()
  if (findings.length) {
    console.error(findings.join('\n'))
    console.error(
      'File guard failed. Remove the finding or review a personal-data allowlist entry.',
    )
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`File guard could not run: ${error.code ?? error.message}`)
  process.exitCode = 2
})
