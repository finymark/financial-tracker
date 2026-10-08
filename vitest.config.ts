import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Real SQLite files, online backups and migrations on Windows CI runners are
    // many times slower than on a developer machine (runs with 30-40x slower
    // tests have been seen), so CI gets a much larger budget.
    testTimeout: process.env.CI ? 120_000 : 30_000,
    hookTimeout: process.env.CI ? 120_000 : 30_000,
  },
})
