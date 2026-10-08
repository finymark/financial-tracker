import { parentPort } from 'node:worker_threads'
import { preprocessReceiptImageInWorker } from './receipt-preprocessing-core.ts'

const port = parentPort
if (!port) throw new Error('Receipt preprocessing worker has no parent')

port.on('message', async (request: { id: number; image: Uint8Array }) => {
  try {
    const image = await preprocessReceiptImageInWorker(
      Buffer.from(request.image),
    )
    port.postMessage({ id: request.id, image })
  } catch (error) {
    port.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
