import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
