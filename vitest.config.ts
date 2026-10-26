import { defineConfig } from 'vitest/config'

// Unit tests for the app's logic and the API route. Kept apart from
// vite.config.ts so the dev-server plugin (and its env loading) never runs here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'cli/**/*.test.ts'],
    environment: 'node',
  },
})
