import { useFilePickers } from '../../hooks/useFilePickers'
import type { PickedFile } from '../../lib/importFiles'
import { ImportSummary, type ImportNotice } from '../FileSidebar/FileSidebar'
import {
  ArrowRightIcon,
  CardsIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  SparkleIcon,
} from '../icons'
import './Home.css'

/** The session that can be picked up again, if there is one. */
export interface ResumableSession {
  projectName: string
  fileCount: number
  isTutorial: boolean
}

interface HomeProps {
  resumable: ResumableSession | null
  importing: boolean
  notice: ImportNotice | null
  onStartBlank: () => void
  onOpenFolder: (picked: PickedFile[]) => void
  onOpenFiles: (picked: PickedFile[]) => void
  onDismissNotice: () => void
  onResume: () => void
  onOpenTutorial: () => void
  /** Saved flashcards and how many are due now; the line shows once there are any. */
  flashcards: { total: number; due: number }
  onOpenFlashcards: () => void
}

/** The start screen: begin a session, pick up the last one, or take the tutorial. */
export function Home({
  resumable,
  importing,
  notice,
  onStartBlank,
  onOpenFolder,
  onOpenFiles,
  onDismissNotice,
  onResume,
  onOpenTutorial,
  flashcards,
  onOpenFlashcards,
}: HomeProps) {
  const { pickFolder, pickFiles, inputs } = useFilePickers(onOpenFolder, onOpenFiles)
  const tutorialOpen = resumable?.isTutorial ?? false

  return (
    <main className="home">
      <div className="home__inner">
        <header className="home__hero">
          <h1 className="home__title">Understand any code, one piece at a time.</h1>
          <p className="home__lead">
            Bring code you’re stuck on: a snippet, a terminal command, a whole project.
            Highlight anything that confuses you and LensCode explains it in plain English.
          </p>
        </header>

        <button type="button" className="home-start" onClick={onStartBlank}>
          <span className="home-start__icon">
            <PlusIcon size={24} />
          </span>
          <span className="home-start__text">
            <span className="home-start__title">Start a new session</span>
            <span className="home-start__hint">Paste or type code, a command or an error message</span>
          </span>
          <ArrowRightIcon size={20} className="home-start__arrow" />
        </button>

        <div className="home__open">
          <button type="button" className="btn btn--secondary home__open-btn" onClick={pickFolder}>
            <FolderOpenIcon />
            Open a folder
          </button>
          <button type="button" className="btn btn--secondary home__open-btn" onClick={pickFiles}>
            <FileIcon />
            Open files
          </button>
          {inputs}
        </div>
        <p className="home__note">
          Or drop a folder or files anywhere on this page. Nothing is uploaded: only the code you
          choose to explain is sent.
        </p>

        {(importing || notice) && (
          <div className="home__status">
            {importing ? (
              <p className="import-summary import-summary--busy">Opening…</p>
            ) : (
              notice && <ImportSummary notice={notice} onDismiss={onDismissNotice} />
            )}
          </div>
        )}

        {resumable && (
          <section className="home__section" aria-labelledby="home-resume">
            <h2 className="home__section-title" id="home-resume">
              Pick up where you left off
            </h2>
            <button type="button" className="home-card" onClick={onResume}>
              <FolderIcon className="home-card__icon" />
              <span className="home-card__text">
                <span className="home-card__name">{resumable.projectName}</span>
                <span className="home-card__meta">
                  {resumable.fileCount} {resumable.fileCount === 1 ? 'file' : 'files'}
                  {resumable.isTutorial && ' · Tutorial'}
                </span>
              </span>
              <span className="home-card__action">
                Continue
                <ArrowRightIcon size={14} />
              </span>
            </button>
          </section>
        )}

        {flashcards.total > 0 && (
          <section className="home__section home-flashcards" aria-labelledby="home-flashcards">
            <CardsIcon className="home-flashcards__icon" />
            <div className="home-flashcards__text">
              <h2 className="home-flashcards__title" id="home-flashcards">
                Flashcards
              </h2>
              <p className="home-flashcards__body">
                {flashcards.due > 0
                  ? 'Practise the explanations you saved.'
                  : 'All caught up. Nothing to review right now.'}
              </p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenFlashcards}>
              {flashcards.due > 0
                ? `Review ${flashcards.due} ${flashcards.due === 1 ? 'card' : 'cards'}`
                : 'See cards'}
            </button>
          </section>
        )}

        <section className="home__section home-tutorial" aria-labelledby="home-tutorial">
          <SparkleIcon className="home-tutorial__icon" />
          <div className="home-tutorial__text">
            <h2 className="home-tutorial__title" id="home-tutorial">
              New to LensCode?
            </h2>
            <p className="home-tutorial__body">
              Try it on a small practice project with a step-by-step guide. No code of your own
              needed.
            </p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenTutorial}>
            {tutorialOpen ? 'Restart tutorial' : 'Open tutorial'}
          </button>
        </section>
      </div>
    </main>
  )
}
