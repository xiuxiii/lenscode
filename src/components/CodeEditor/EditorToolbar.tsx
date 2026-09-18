import { getLanguage } from '../../data/languages'
import type { CodeSelection, LanguageId, WorkspaceFile } from '../../types/workspace'
import { FileIcon } from '../icons'
import { LanguageSelector } from '../LanguageSelector/LanguageSelector'
import { ExplainButton } from '../SelectionActions/SelectionActions'

interface EditorToolbarProps {
  file: WorkspaceFile
  selection: CodeSelection | null
  onLanguageChange: (language: LanguageId) => void
  onExplain: () => void
}

function previewSelection(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine
}

export function EditorToolbar({
  file,
  selection,
  onLanguageChange,
  onExplain,
}: EditorToolbarProps) {
  const hasSelection = Boolean(selection?.text.trim())
  return (
    <div className="editor-toolbar">
      <span className="editor-toolbar__file" title={file.name}>
        <FileIcon size={14} />
        <span className="editor-toolbar__file-name">{file.name}</span>
      </span>
      <span className="editor-toolbar__spacer" />
      {hasSelection && selection ? (
        <span className="editor-toolbar__hint">
          Selected
          <code className="inline-code">{previewSelection(selection.text)}</code>
        </span>
      ) : (
        <span className="editor-toolbar__hint">
          Highlight any {getLanguage(file.language).label} to inspect it
        </span>
      )}
      <LanguageSelector value={file.language} onChange={onLanguageChange} />
      <ExplainButton
        onClick={onExplain}
        disabled={!hasSelection}
        showShortcut
        title={hasSelection ? 'Explain the selected code' : 'Select some code first'}
      />
    </div>
  )
}
