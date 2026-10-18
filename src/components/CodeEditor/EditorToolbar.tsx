import type { CodeSelection, WorkspaceFile } from '../../types/workspace'
import { FileIcon } from '../icons'
import { LanguageBadge } from '../LanguageBadge/LanguageBadge'
import { ExplainButton } from '../SelectionActions/SelectionActions'

interface EditorToolbarProps {
  file: WorkspaceFile
  selection: CodeSelection | null
  onExplain: () => void
}

function previewSelection(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine
}

export function EditorToolbar({
  file,
  selection,
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
          {file.language === 'plaintext'
            ? 'Paste or type code, then highlight any part of it'
            : 'Highlight any part of the code to inspect it'}
        </span>
      )}
      <LanguageBadge language={file.language} />
      <ExplainButton
        onClick={onExplain}
        disabled={!hasSelection}
        showShortcut
        title={hasSelection ? 'Explain the selected code' : 'Select some code first'}
      />
    </div>
  )
}
