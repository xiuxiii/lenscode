import type { Explanation } from '../../types/explanation'
import type { ImportResult, PickedFile } from '../../lib/importFiles'
import { pickedFromInput } from '../../lib/importFiles'
import type { WorkspaceFile } from '../../types/workspace'
import { CloseIcon, FileIcon, FolderOpenIcon, HistoryIcon, PlusIcon, RetryIcon } from '../icons'
import { FileTree } from './FileTree'
import './FileSidebar.css'

/** What the last open (folder or files) did, for the summary note. */
export interface ImportNotice {
  mode: 'folder' | 'files'
  result: ImportResult
}

interface FileSidebarProps {
  projectName: string
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
  /** The built-in example project is showing (offer Reset rather than Close). */
  isExample: boolean
  onCloseProject: () => void
  onReopenExplanation: (explanation: Explanation) => void
  onClearHistory: () => void
}

function compact(code: string): string {
  const oneLine = code.replace(/\s+/g, ' ').trim()
  return oneLine.length > 28 ? `${oneLine.slice(0, 28)}…` : oneLine
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
    <div className={`import-summary${opened === 0 ? ' import-summary--empty' : ''}`} role="status">
      <div className="import-summary__head">
        <p className="import-summary__headline">{headline}</p>
        <button
          type="button"
          className="icon-button import-summary__close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <CloseIcon size={12} />
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

export function FileSidebar({
  projectName,
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
  isExample,
  onCloseProject,
  onReopenExplanation,
  onClearHistory,
}: FileSidebarProps) {
  return (
    <nav className="file-sidebar" aria-label="Files">
      <div className="file-sidebar__section">
        <div className="file-sidebar__open">
          <label className="open-button" title="Open a whole project folder from your computer">
            <FolderOpenIcon size={14} />
            Open folder
            <input
              type="file"
              className="open-button__input"
              // Not in React's types; enables folder picking in every major browser.
              ref={(el) => el?.setAttribute('webkitdirectory', '')}
              onChange={(e) => {
                onOpenFolder(pickedFromInput(e.target.files))
                e.target.value = ''
              }}
            />
          </label>
          <label className="open-button" title="Open one or more files from your computer">
            <FileIcon size={14} />
            Open files
            <input
              type="file"
              multiple
              className="open-button__input"
              onChange={(e) => {
                onOpenFiles(pickedFromInput(e.target.files))
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="file-sidebar__hint">
          Or drag them anywhere onto this window. Files stay on your computer, and
          LensCode remembers them in this browser.
        </p>

        {importing && <p className="import-summary import-summary--busy">Opening…</p>}
        {!importing && notice && <ImportSummary notice={notice} onDismiss={onDismissNotice} />}

        <div className="file-sidebar__header">
          <span className="eyebrow" title={projectName}>
            {projectName}
          </span>
          <span className="file-sidebar__actions">
            <button
              type="button"
              className="icon-button file-sidebar__add"
              onClick={onNewFile}
              title="New blank file (paste anything into it)"
              aria-label="New file"
            >
              <PlusIcon size={14} />
            </button>
            <button
              type="button"
              className="icon-button file-sidebar__add"
              onClick={onCloseProject}
              title={
                isExample
                  ? 'Reset the example project'
                  : `Close ${projectName} and go back to the example project (your files on disk are not touched)`
              }
              aria-label={isExample ? 'Reset example project' : 'Close project'}
            >
              {isExample ? <RetryIcon size={13} /> : <CloseIcon size={13} />}
            </button>
          </span>
        </div>
        <FileTree
          key={projectName}
          files={files}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
        />
      </div>

      <div className="file-sidebar__section file-sidebar__section--recent">
        <div className="file-sidebar__header">
          <span className="eyebrow">
            <HistoryIcon size={12} className="file-sidebar__header-icon" />
            Recent
          </span>
          {history.length > 0 && (
            <button
              type="button"
              className="file-sidebar__text-button"
              onClick={onClearHistory}
              title="Forget these saved explanations"
            >
              Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="file-sidebar__muted">
            Code you explain will show up here.
          </p>
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
                  <code>{compact(item.selectedCode)}</code>
                  <span className="recent-list__concept">{item.concept}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  )
}
