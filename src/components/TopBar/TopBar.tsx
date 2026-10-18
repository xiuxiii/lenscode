import { LensLogo, PanelLeftIcon } from '../icons'
import './TopBar.css'

interface TopBarProps {
  projectName: string
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function TopBar({ projectName, sidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <header className="top-bar">
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
      <a className="top-bar__brand" href="/" aria-label="LensCode home">
        <LensLogo />
        <span className="top-bar__name">LensCode</span>
      </a>
      <span className="top-bar__separator" aria-hidden="true">
        /
      </span>
      <span className="top-bar__project" title={projectName}>
        {projectName}
      </span>
    </header>
  )
}
