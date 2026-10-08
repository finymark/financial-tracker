import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = await readFile(`${root}/build/icon.svg`)
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]

const images = await Promise.all(
  sizes.map((size) =>
    sharp(source, { density: 384 })
      .resize(size, size, { fit: 'fill' })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer(),
  ),
)

await writeFile(`${root}/build/icon.png`, images.at(-1))

const headerSize = 6 + sizes.length * 16
let imageOffset = headerSize
const directory = Buffer.alloc(headerSize)
directory.writeUInt16LE(0, 0)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(sizes.length, 4)

for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16
  directory.writeUInt8(size === 256 ? 0 : size, entry)
  directory.writeUInt8(size === 256 ? 0 : size, entry + 1)
  directory.writeUInt8(0, entry + 2)
  directory.writeUInt8(0, entry + 3)
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(images[index].length, entry + 8)
  directory.writeUInt32LE(imageOffset, entry + 12)
  imageOffset += images[index].length
}

await writeFile(`${root}/build/icon.ico`, Buffer.concat([directory, ...images]))
