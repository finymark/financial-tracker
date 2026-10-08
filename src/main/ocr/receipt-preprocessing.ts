import sharp from 'sharp'

const UPSCALE_BELOW = 1500
const MAX_DESKEW_ANGLE = 10

interface GrayImage {
  data: Buffer
  width: number
  height: number
}

function adaptiveBinarize(image: GrayImage): Buffer {
  const { data, width, height } = image
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0
    for (let x = 0; x < width; x += 1) {
      rowSum += data[y * width + x]
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum
    }
  }

  const radius = Math.max(
    12,
    Math.min(32, Math.round(Math.min(width, height) / 40)),
  )
  const binary = Buffer.allocUnsafe(width * height)
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(width - 1, x + radius)
      const sum =
        integral[(bottom + 1) * stride + right + 1] -
        integral[top * stride + right + 1] -
        integral[(bottom + 1) * stride + left] +
        integral[top * stride + left]
      const mean = sum / ((right - left + 1) * (bottom - top + 1))
      binary[y * width + x] = data[y * width + x] < mean - 10 ? 0 : 255
    }
  }
  return binary
}

function blackPixels(image: GrayImage): { x: number; y: number }[] {
  let count = 0
  for (const value of image.data) if (value === 0) count += 1
  const step = Math.max(1, Math.ceil(count / 200_000))
  const pixels: { x: number; y: number }[] = []
  let seen = 0
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[y * image.width + x] !== 0) continue
      if (seen % step === 0) pixels.push({ x, y })
      seen += 1
    }
  }
  return pixels
}

function projectionScore(
  pixels: readonly { x: number; y: number }[],
  angle: number,
  diagonal: number,
): number {
  const radians = (angle * Math.PI) / 180
  const sine = Math.sin(radians)
  const cosine = Math.cos(radians)
  const rows = new Uint32Array(diagonal * 2 + 3)
  for (const { x, y } of pixels) {
    const row = Math.round(x * sine + y * cosine) + diagonal
    rows[row] += 1
  }
  let score = 0
  for (const count of rows) score += count * count
  return score
}

function estimateDeskewAngle(image: GrayImage): number {
  const pixels = blackPixels(image)
  if (pixels.length < 100) return 0
  const diagonal = Math.ceil(Math.hypot(image.width, image.height))
  const scoreAtZero = projectionScore(pixels, 0, diagonal)
  let bestAngle = 0
  let bestScore = scoreAtZero
  for (let angle = -MAX_DESKEW_ANGLE; angle <= MAX_DESKEW_ANGLE; angle += 0.5) {
    const score = projectionScore(pixels, angle, diagonal)
    if (score > bestScore) {
      bestAngle = angle
      bestScore = score
    }
  }
  const coarseAngle = bestAngle
  for (
    let angle = coarseAngle - 0.5;
    angle <= coarseAngle + 0.5;
    angle += 0.1
  ) {
    if (Math.abs(angle) > MAX_DESKEW_ANGLE) continue
    const score = projectionScore(pixels, angle, diagonal)
    if (score > bestScore) {
      bestAngle = angle
      bestScore = score
    }
  }
  return bestScore > scoreAtZero * 1.02 && Math.abs(bestAngle) >= 0.2
    ? bestAngle
    : 0
}

async function rotateBinary(
  image: GrayImage,
  angle: number,
): Promise<GrayImage> {
  if (angle === 0) return image
  const { data, info } = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 1 },
  })
    .rotate(angle, { background: '#ffffff' })
    .toColourspace('b-w')
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

export async function preprocessReceiptImage(image: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image)
    .rotate()
    .grayscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width < 1 || info.height < 1)
    throw new Error('Invalid receipt image')
  let binary: GrayImage = {
    data: adaptiveBinarize({ data, width: info.width, height: info.height }),
    width: info.width,
    height: info.height,
  }
  binary = await rotateBinary(binary, estimateDeskewAngle(binary))

  let pipeline = sharp(binary.data, {
    raw: { width: binary.width, height: binary.height, channels: 1 },
  })
  if (Math.max(binary.width, binary.height) < UPSCALE_BELOW) {
    pipeline = pipeline.resize(binary.width * 2, binary.height * 2, {
      kernel: sharp.kernel.nearest,
    })
  }
  return pipeline.toColourspace('b-w').png().toBuffer()
}
