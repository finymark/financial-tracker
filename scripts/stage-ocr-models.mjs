import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destination = join(root, 'node_modules', 'financial-tracker-ocr-models')
const dataScope = '@tesseract.js-data'

rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
for (const language of ['hun', 'deu', 'eng']) {
  // ADR 0004 calls for fast local models. The pinned data packages publish
  // those gzip-compressed integer models under the upstream best_int name.
  copyFileSync(
    join(
      root,
      'node_modules',
      dataScope,
      language,
      '4.0.0_best_int',
      `${language}.traineddata.gz`,
    ),
    join(destination, `${language}.traineddata.gz`),
  )
}
