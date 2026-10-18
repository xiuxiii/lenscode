import { getLanguage } from '../../data/languages'
import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import type { WorkspaceFile } from '../../types/workspace'
import { FileIcon, SparkleIcon } from '../icons'

interface EditorToolbarProps {
  file: WorkspaceFile
  /** True when there is a non-empty selection to explain. */
  canExplain: boolean
  onExplain: () => void
}

/** The editor's tab bar: which file, which language, and Explain. */
export function EditorToolbar({ file, canExplain, onExplain }: EditorToolbarProps) {
  const language = getLanguage(file.language)
  return (
    <div className="editor-toolbar">
      <span className="editor-toolbar__file" title={file.path}>
        <FileIcon />
        <span className="editor-toolbar__file-name">{file.path}</span>
      </span>
      <span
        className="editor-toolbar__language"
        title={`${language.description} (Detected automatically from the code.)`}
      >
        {language.label}
      </span>
      <button
        type="button"
        className="btn btn--secondary editor-toolbar__explain"
        onClick={onExplain}
        disabled={!canExplain}
        title={canExplain ? `Explain the selection (${EXPLAIN_SHORTCUT})` : 'Select some code first'}
      >
        <SparkleIcon />
        Explain
      </button>
    </div>
  )
}
