import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import { SparkleIcon } from '../icons'
import './SelectionActions.css'

export interface PopoverPosition {
  top: number
  left: number
}

interface SelectionActionsProps {
  position: PopoverPosition | null
  onExplain: () => void
}

/**
 * The floating "Explain" pill beside the editor selection — the one
 * prominent Explain call to action. CodeEditor places it clear of the
 * selected text.
 */
export function SelectionActions({ position, onExplain }: SelectionActionsProps) {
  if (!position) return null
  return (
    <button
      type="button"
      className="selection-pill"
      style={{ top: position.top, left: position.left }}
      // Keep the editor focused (and the selection alive) through the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onExplain}
      title={`Explain the selection (${EXPLAIN_SHORTCUT})`}
    >
      <SparkleIcon size={14} />
      Explain
    </button>
  )
}
