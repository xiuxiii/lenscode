import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { ImportResult, PickedFile } from '../../lib/importFiles'
import { pickedFromInput } from '../../lib/importFiles'
import type { Explanation } from '../../types/explanation'
import type { WorkspaceFile } from '../../types/workspace'
import {
  AlertIcon,
  ChevronDownIcon,
  CloseIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  RetryIcon,
} from '../icons'
import { FileTree } from './FileTree'
import './FileSidebar.css'

/** What the last open (folder or files) did, for the summary note. */
export interface ImportNotice {
  mode: 'folder' | 'files'
  result: ImportResult
}

interface FileSidebarProps {
  files: WorkspaceFile[]
  activeFile: WorkspaceFile
  history: Explanation[]
  importing: boolean
  notice: ImportNotice | null
  onSelectFile: (id: string) => void
  onNewFile: () => void
  onOpenFolder: (picked: PickedFile[]) => void
  onOpenFiles: (picked: PickedFile[]) => void
  onDismissNotice: () => void
  projectName: string
  /** The built-in example project is showing (offer Reset rather than Close). */
  isExample: boolean
  onCloseProject: () => void
  onReopenExplanation: (explanation: Explanation) => void
  onClearHistory: () => void
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function listNames(paths: string[], max = 3): string {
  const names = paths.slice(0, max).join(', ')
  return paths.length > max ? `${names} and ${paths.length - max} more` : names
}

/** Plain-English account of what was opened and what was left out, and why. */
function ImportSummary({ notice, onDismiss }: { notice: ImportNotice; onDismiss: () => void }) {
  const { mode, result } = notice
  const { files, rootName, skipped } = result
  const opened = files.length

  const headline =
    opened === 0
      ? mode === 'folder'
        ? 'Nothing in that folder could be opened.'
        : 'None of those files could be opened.'
      : mode === 'folder' && rootName
        ? `Opened ${plural(opened, 'file')} from ${rootName}.`
        : `Added ${plural(opened, 'file')}.`

  const details: string[] = []
  if (skipped.folders.length > 0) {
    details.push(
      `Left out ${skipped.folders.join(', ')}: downloaded libraries, build output and history, not code written for this project.`,
    )
  }
  if (skipped.secrets.length > 0) {
    details.push(
      `Not opened, for safety: ${listNames(skipped.secrets)}. Files like these usually hold passwords or API keys.`,
    )
  }
  if (skipped.binary > 0) {
    details.push(`${plural(skipped.binary, 'image or other non-text file', 'images or other non-text files')} left out.`)
  }
  if (skipped.tooLarge.length > 0) {
    details.push(`Too large to explain: ${listNames(skipped.tooLarge)}.`)
  }
  if (skipped.overLimit > 0) {
    details.push(`${plural(skipped.overLimit, 'more file')} left out to keep things fast.`)
  }

  return (
    <div className="import-summary" role="status">
      <div className="import-summary__head">
        {opened === 0 && <AlertIcon className="import-summary__alert" />}
        <p className="import-summary__headline">{headline}</p>
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <CloseIcon />
        </button>
      </div>
      {details.length > 0 && (
        <ul className="import-summary__details">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One "Open…" button with a two-item menu: a folder, or individual files. */
function OpenMenu({
  onOpenFolder,
  onOpenFiles,
}: {
  onOpenFolder: (picked: PickedFile[]) => void
  onOpenFiles: (picked: PickedFile[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (input: RefObject<HTMLInputElement | null>) => {
    setOpen(false)
    input.current?.click()
  }

  const moveFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div className="open-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--secondary open-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Open code from your computer. It stays on your computer; LensCode remembers it in this browser."
      >
        <FolderOpenIcon />
        Open…
        <ChevronDownIcon size={14} className="open-menu__chevron" />
      </button>
      {open && (
        <div className="open-menu__menu" role="menu" onKeyDown={moveFocus}>
          <button
            type="button"
            role="menuitem"
            className="open-menu__item"
            onClick={() => choose(folderInput)}
            title="Open a whole project folder"
          >
            <FolderIcon />
            Open folder…
          </button>
          <button
            type="button"
            role="menuitem"
            className="open-menu__item"
            onClick={() => choose(filesInput)}
            title="Add one or more files to this project"
          >
            <FileIcon />
            Open files…
          </button>
        </div>
      )}
      <input
        ref={(el) => {
          folderInput.current = el
          // Not in React's types; enables folder picking in every major browser.
          el?.setAttribute('webkitdirectory', '')
        }}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onOpenFolder(pickedFromInput(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        ref={filesInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onOpenFiles(pickedFromInput(e.target.files))
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function FileSidebar({
  files,
  activeFile,
  history,
  importing,
  notice,
  onSelectFile,
  onNewFile,
  onOpenFolder,
  onOpenFiles,
  onDismissNotice,
  projectName,
  isExample,
  onCloseProject,
  onReopenExplanation,
  onClearHistory,
}: FileSidebarProps) {
  return (
    <nav className="file-sidebar" aria-label="Files">
      <div className="file-sidebar__header">
        <h2 className="file-sidebar__title">Files</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={onNewFile}
          title="New blank file (paste anything into it)"
          aria-label="New file"
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onCloseProject}
          title={
            isExample
              ? 'Reset the example project'
              : `Close ${projectName} and go back to the example project (your files on disk are not touched)`
          }
          aria-label={isExample ? 'Reset example project' : 'Close project'}
        >
          {isExample ? <RetryIcon /> : <CloseIcon />}
        </button>
      </div>

      <div className="file-sidebar__scroll">
        <OpenMenu onOpenFolder={onOpenFolder} onOpenFiles={onOpenFiles} />

        {importing && <p className="import-summary import-summary--busy">Opening…</p>}
        {!importing && notice && <ImportSummary notice={notice} onDismiss={onDismissNotice} />}

        <FileTree
          key={projectName}
          files={files}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
        />

        <section className="file-sidebar__section" aria-label="Recent explanations">
          <div className="file-sidebar__section-header">
            <h2 className="file-sidebar__title">Recent</h2>
            {history.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={onClearHistory}
                title="Forget these saved explanations"
              >
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="file-sidebar__empty">Code you explain will show up here.</p>
          ) : (
            <ul className="recent-list">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="recent-list__item"
                    onClick={() => onReopenExplanation(item)}
                    title={`${item.selectedCode}\n\nShows the saved explanation (no new AI request).`}
                  >
                    <code className="recent-list__code">
                      {item.selectedCode.replace(/\s+/g, ' ').trim()}
                    </code>
                    <span className="recent-list__concept">{item.concept}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </nav>
  )
}
