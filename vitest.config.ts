import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Real SQLite files, online backups and migrations on Windows CI runners are
    // several times slower than on a developer machine; the 5 s default flakes.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
