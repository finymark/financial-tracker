import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig(({ command }) => ({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'receipt-preprocessing-worker': resolve(
            'src/main/ocr/receipt-preprocessing-worker.ts',
          ),
        },
        output: { entryFileNames: '[name].js' },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [
      {
        name: 'environment-csp',
        transformIndexHtml(html) {
          return html.replace(
            '%CSP_DEV_CONNECT%',
            command === 'serve' ? 'ws://localhost:* ws://127.0.0.1:*' : '',
          )
        },
      },
      react(),
      tailwindcss(),
    ],
  },
}))
