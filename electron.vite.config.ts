import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  main: {},
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
