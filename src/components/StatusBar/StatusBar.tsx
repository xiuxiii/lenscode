import { getLanguage } from '../../data/languages'
import type { ExplanationStatus } from '../../hooks/useExplanation'
import type { CodeSelection, LanguageId } from '../../types/workspace'
import type { CursorPosition } from '../CodeEditor/CodeEditor'
import './StatusBar.css'

interface StatusBarProps {
  fileName: string
  language: LanguageId
  cursor: CursorPosition
  selection: CodeSelection | null
  explanationStatus: ExplanationStatus
}

const STATUS_TEXT: Record<ExplanationStatus, string> = {
  idle: 'Ready',
  loading: 'Explaining…',
  loaded: 'Explained',
  error: 'Explanation failed',
}

function selectionSummary(selection: CodeSelection): string {
  const chars = selection.text.length
  const lines = selection.endLine - selection.startLine + 1
  const charLabel = `${chars} ${chars === 1 ? 'char' : 'chars'}`
  return lines > 1 ? `${charLabel}, ${lines} lines selected` : `${charLabel} selected`
}

export function StatusBar({
  fileName,
  language,
  cursor,
  selection,
  explanationStatus,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <span className="status-bar__item status-bar__item--status">
          <span className={`status-bar__dot status-bar__dot--${explanationStatus}`} />
          {STATUS_TEXT[explanationStatus]}
        </span>
      </div>
      <div className="status-bar__group">
        {selection && selection.text.length > 0 && (
          <span className="status-bar__item status-bar__item--selection">
            {selectionSummary(selection)}
          </span>
        )}
        <span className="status-bar__item">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="status-bar__item">{getLanguage(language).label}</span>
        <span className="status-bar__item status-bar__item--file">{fileName}</span>
      </div>
    </footer>
  )
}
