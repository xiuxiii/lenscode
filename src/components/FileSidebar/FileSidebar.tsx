import { getLanguage } from '../../data/languages'
import type { Explanation } from '../../types/explanation'
import type { WorkspaceFile } from '../../types/workspace'
import { HistoryIcon, PlusIcon } from '../icons'
import './FileSidebar.css'

interface FileSidebarProps {
  projectName: string
  files: WorkspaceFile[]
  activeFileId: string
  history: Explanation[]
  onSelectFile: (id: string) => void
  onNewFile: () => void
  onReopenExplanation: (explanation: Explanation) => void
}

function compact(code: string): string {
  const oneLine = code.replace(/\s+/g, ' ').trim()
  return oneLine.length > 28 ? `${oneLine.slice(0, 28)}…` : oneLine
}

export function FileSidebar({
  projectName,
  files,
  activeFileId,
  history,
  onSelectFile,
  onNewFile,
  onReopenExplanation,
}: FileSidebarProps) {
  return (
    <nav className="file-sidebar" aria-label="Files">
      <div className="file-sidebar__section">
        <div className="file-sidebar__header">
          <span className="eyebrow">{projectName}</span>
          <button
            type="button"
            className="icon-button file-sidebar__add"
            onClick={onNewFile}
            title="New file"
            aria-label="New file"
          >
            <PlusIcon size={14} />
          </button>
        </div>
        <ul className="file-list">
          {files.map((file) => {
            const lang = getLanguage(file.language)
            const active = file.id === activeFileId
            return (
              <li key={file.id}>
                <button
                  type="button"
                  className={`file-list__item${active ? ' file-list__item--active' : ''}`}
                  onClick={() => onSelectFile(file.id)}
                  aria-current={active ? 'true' : undefined}
                >
                  <span
                    className="file-list__tag"
                    style={{ color: lang.color }}
                    title={lang.label}
                  >
                    {lang.tag}
                  </span>
                  <span className="file-list__name">{file.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="file-sidebar__section file-sidebar__section--recent">
        <div className="file-sidebar__header">
          <span className="eyebrow">
            <HistoryIcon size={12} className="file-sidebar__header-icon" />
            Recent
          </span>
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
                  title={item.selectedCode}
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
