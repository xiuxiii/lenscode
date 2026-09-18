import type { ButtonHTMLAttributes } from 'react'
import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import { SparkleIcon } from '../icons'
import './SelectionActions.css'

interface ExplainButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  size?: 'sm' | 'md'
  showShortcut?: boolean
}

/**
 * The persistent, primary "Explain" action. Used in the editor toolbar and
 * inside the explanation panel.
 */
export function ExplainButton({
  label = 'Explain',
  size = 'sm',
  showShortcut = false,
  className = '',
  ...rest
}: ExplainButtonProps) {
  return (
    <button
      type="button"
      className={`explain-button explain-button--${size} ${className}`}
      {...rest}
    >
      <SparkleIcon size={size === 'sm' ? 13 : 15} />
      <span>{label}</span>
      {showShortcut && <kbd className="explain-button__kbd">{EXPLAIN_SHORTCUT}</kbd>}
    </button>
  )
}

export interface PopoverPosition {
  top: number
  left: number
  placement: 'above' | 'below'
}

interface SelectionActionsProps {
  position: PopoverPosition | null
  onExplain: () => void
}

/**
 * Small floating affordance that appears next to the editor selection.
 * Intentionally compact so it never hides the code being inspected.
 */
export function SelectionActions({ position, onExplain }: SelectionActionsProps) {
  if (!position) return null
  return (
    <div
      className={`selection-actions selection-actions--${position.placement}`}
      style={{ top: position.top, left: position.left }}
      role="toolbar"
      aria-label="Selection actions"
    >
      <button
        type="button"
        className="selection-actions__button"
        // Prevent the editor from blurring (which would dismiss this popover)
        // before the click registers.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onExplain}
      >
        <SparkleIcon size={13} />
        <span>Explain</span>
        <kbd>{EXPLAIN_SHORTCUT}</kbd>
      </button>
    </div>
  )
}
