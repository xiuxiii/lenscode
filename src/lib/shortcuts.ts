const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Human-readable label for the "explain selection" shortcut. */
export const EXPLAIN_SHORTCUT = IS_MAC ? '⌘E' : 'Ctrl+E'
