import { chmodSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Bundles the `lens` command, and the engine it shares with the web app,
 * into one file that Node 20.3+ runs as is:
 *
 *   npm run build:cli  →  dist-cli/lens.mjs
 *
 * An SSR build, so Vite targets Node and leaves `node:*` imports alone.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  // The key is read when lens runs (see cli/env.ts), never baked into the bundle.
  envDir: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    ssr: 'cli/lens.ts',
    outDir: 'dist-cli',
    emptyOutDir: true,
    target: 'node20',
    rolldownOptions: {
      output: {
        format: 'es',
        entryFileNames: 'lens.mjs',
        // Added last, so nothing can end up above it.
        postBanner: '#!/usr/bin/env node',
      },
    },
  },
  plugins: [
    {
      name: 'lens-executable',
      // So ./dist-cli/lens.mjs runs by itself, like the `lens` npm link installs.
      writeBundle({ dir }) {
        if (dir) chmodSync(join(dir, 'lens.mjs'), 0o755)
      },
    },
  ],
})
