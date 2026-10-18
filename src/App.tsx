import { AppShell } from './components/AppShell/AppShell'
import type { SavedSession } from './lib/sessionStore'

export default function App({ session }: { session: SavedSession }) {
  return <AppShell session={session} />
}
