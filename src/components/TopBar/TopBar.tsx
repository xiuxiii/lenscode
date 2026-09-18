import { ChevronDownIcon, LensLogo, PanelLeftIcon, SettingsIcon } from '../icons'
import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import './TopBar.css'

interface TopBarProps {
  projectName: string
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function TopBar({ projectName, sidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button
          type="button"
          className={`icon-button top-bar__sidebar-toggle${sidebarOpen ? ' is-active' : ''}`}
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide files' : 'Show files'}
          aria-label={sidebarOpen ? 'Hide files' : 'Show files'}
          aria-pressed={sidebarOpen}
        >
          <PanelLeftIcon size={15} />
        </button>
        <a className="top-bar__brand" href="/" aria-label="LensCode home">
          <LensLogo size={18} />
          <span className="top-bar__name">LensCode</span>
        </a>
      </div>

      <div className="top-bar__center">
        <button
          type="button"
          className="top-bar__project"
          title="Project switching is not available yet"
        >
          <span className="top-bar__project-dot" />
          <span>{projectName}</span>
          <ChevronDownIcon size={12} />
        </button>
      </div>

      <div className="top-bar__right">
        <span className="top-bar__hint">
          Select code, then <kbd className="kbd">{EXPLAIN_SHORTCUT}</kbd>
        </span>
        <button
          type="button"
          className="icon-button"
          title="Settings (coming soon)"
          aria-label="Settings"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
    </header>
  )
}
