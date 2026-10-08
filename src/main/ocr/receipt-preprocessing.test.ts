import sharp from 'sharp'
import { describe, expect, test } from 'vitest'
import { preprocessReceiptImage } from './receipt-preprocessing'

async function barPattern(angle: number, width = 480, height = 300) {
  const bars = [70, 120, 170, 220]
    .map((y) => `<rect x="70" y="${y}" width="340" height="7" fill="black"/>`)
    .join('')
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="white"/>
        <g transform="rotate(${angle} ${width / 2} ${height / 2})">${bars}</g>
      </svg>`,
    ),
  )
    .png()
    .toBuffer()
}

async function blackPixelAngle(image: Buffer): Promise<number> {
  const { data, info } = await sharp(image)
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })
  const columns: { x: number; meanY: number }[] = []
  for (let x = 0; x < info.width; x += 1) {
    let sum = 0
    let count = 0
    for (let y = 0; y < info.height; y += 1) {
      if (data[y * info.width + x] === 0) {
        sum += y
        count += 1
      }
    }
    if (count) columns.push({ x, meanY: sum / count })
  }
  const meanX =
    columns.reduce((sum, point) => sum + point.x, 0) / columns.length
  const meanY =
    columns.reduce((sum, point) => sum + point.meanY, 0) / columns.length
  const numerator = columns.reduce(
    (sum, point) => sum + (point.x - meanX) * (point.meanY - meanY),
    0,
  )
  const denominator = columns.reduce(
    (sum, point) => sum + (point.x - meanX) ** 2,
    0,
  )
  return (Math.atan(numerator / denominator) * 180) / Math.PI
}

describe('receipt preprocessing', () => {
  test('produces single-channel black/white output and deskews a rotated pattern', async () => {
    const original = await barPattern(5)
    const snapshot = Buffer.from(original)
    const output = await preprocessReceiptImage(original)
    const metadata = await sharp(output).metadata()
    const { data, info } = await sharp(output)
      .toColourspace('b-w')
      .raw()
      .toBuffer({ resolveWithObject: true })

    expect(metadata.channels).toBe(1)
    expect(info.channels).toBe(1)
    expect([...new Set(data)]).toEqual([255, 0])
    expect(Math.abs(await blackPixelAngle(output))).toBeLessThanOrEqual(1)
    expect(original).toEqual(snapshot)
  })

  test('upscales small images by two after preprocessing', async () => {
    const input = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer()
    const metadata = await sharp(await preprocessReceiptImage(input)).metadata()
    expect(metadata.width).toBe(640)
    expect(metadata.height).toBe(360)
    expect(metadata.channels).toBe(1)
  })

  test('uses a local threshold on uneven backgrounds', async () => {
    const input = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="300">
          <defs><linearGradient id="g"><stop stop-color="#888"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
          <rect x="100" y="100" width="500" height="12" fill="#222"/>
          <rect x="1000" y="180" width="500" height="12" fill="#555"/>
        </svg>`,
      ),
    )
      .png()
      .toBuffer()
    const output = await preprocessReceiptImage(input)
    const metadata = await sharp(output).metadata()
    const { data, info } = await sharp(output)
      .toColourspace('b-w')
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(metadata.channels).toBe(1)
    expect(info.channels).toBe(1)
    expect(new Set(data)).toEqual(new Set([0, 255]))
  })
})
