import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Monaco Editor is bundled locally (no CDN) and is large by nature.
    chunkSizeWarningLimit: 5000,
  },
})
