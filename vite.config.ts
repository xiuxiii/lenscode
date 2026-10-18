import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { explainApi } from './server/vitePlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // explainApi() serves POST /api/explain (dev + preview) using the
  // server-side LLM_API_KEY. See the "AI API Integration" section of the README.
  plugins: [react(), explainApi()],
  build: {
    // Monaco Editor is bundled locally (no CDN) and is large by nature.
    chunkSizeWarningLimit: 5000,
  },
})
