import { LensLogo, PanelLeftIcon, PlusIcon } from '../icons'
import './TopBar.css'

interface TopBarProps {
  /** The open session, or null on the start screen. */
  session: { projectName: string; isTutorial: boolean } | null
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** Go to the start screen. */
  onHome: () => void
}

export function TopBar({ session, sidebarOpen, onToggleSidebar, onHome }: TopBarProps) {
  return (
    <header className="top-bar">
      {session && (
        <button
          type="button"
          className={`icon-btn icon-btn--lg${sidebarOpen ? ' top-bar__toggle--on' : ''}`}
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide files' : 'Show files'}
          aria-label={sidebarOpen ? 'Hide files' : 'Show files'}
          aria-pressed={sidebarOpen}
        >
          <PanelLeftIcon />
        </button>
      )}
      <button
        type="button"
        className="top-bar__brand"
        onClick={onHome}
        title="Start screen"
        aria-label="LensCode start screen"
      >
        <LensLogo />
        <span className="top-bar__name">LensCode</span>
      </button>
      {session && (
        <>
          <span className="top-bar__separator" aria-hidden="true">
            /
          </span>
          <span className="top-bar__project" title={session.projectName}>
            {session.projectName}
          </span>
          {session.isTutorial && <span className="top-bar__badge">Tutorial</span>}
          <button
            type="button"
            className="btn btn--secondary btn--sm top-bar__new"
            onClick={onHome}
            title="Paste new code, open a folder or open files"
            aria-label="New session"
          >
            <PlusIcon />
            <span className="top-bar__new-label">New session</span>
          </button>
        </>
      )}
    </header>
  )
}
