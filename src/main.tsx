import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted (no render-blocking request to a font CDN): one sans, one mono.
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource/geist-mono/600.css'
import './index.css'
import App from './App.tsx'
import { loadSession } from './lib/sessionStore'

// Restore the last session before the first render, so a reload never flashes
// the example project first. loadSession never rejects and gives up quickly.
void loadSession().then((session) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App session={session} />
    </StrictMode>,
  )
})
