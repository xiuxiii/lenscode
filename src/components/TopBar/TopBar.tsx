import { CardsIcon, LensLogo, PanelLeftIcon, PlusIcon } from '../icons'
import './TopBar.css'

interface TopBarProps {
  /** The open session, or null on the start screen. */
  session: { projectName: string; isTutorial: boolean } | null
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** Go to the start screen. */
  onHome: () => void
  /** How many flashcards are due now, shown as a count. */
  flashcardsDue: number
  /** The Flashcards screen is showing. */
  flashcardsOpen: boolean
  onFlashcards: () => void
}

export function TopBar({
  session,
  sidebarOpen,
  onToggleSidebar,
  onHome,
  flashcardsDue,
  flashcardsOpen,
  onFlashcards,
}: TopBarProps) {
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
      <button
        type="button"
        className={`btn btn--ghost btn--sm top-bar__flashcards${flashcardsOpen ? ' top-bar__flashcards--on' : ''}`}
        onClick={onFlashcards}
        title={flashcardsDue > 0 ? `Review your flashcards (${flashcardsDue} due)` : 'Your flashcards'}
        aria-label={flashcardsDue > 0 ? `Flashcards, ${flashcardsDue} due` : 'Flashcards'}
        aria-current={flashcardsOpen ? 'page' : undefined}
      >
        <CardsIcon />
        <span className="top-bar__flashcards-label">Flashcards</span>
        {flashcardsDue > 0 && (
          <span className="top-bar__count">{flashcardsDue > 99 ? '99+' : flashcardsDue}</span>
        )}
      </button>
    </header>
  )
}
