import type { SourceRange } from '../types/explanation.ts'

/**
 * Collapse a selection into a comparable key: trim, drop trailing
 * semicolons / commas, collapse internal whitespace, lowercase.
 *
 * Used by the UI to tell whether the live selection is the one already being
 * explained.
 */
export function normalizeSelection(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[;,]+$/, '')
    .trim()
    .toLowerCase()
}

/**
 * The range covering all of `text`, as if every character were selected.
 * Editor coordinates: 1-based, and the end column is just past the last character.
 */
export function wholeRange(text: string): SourceRange {
  const lines = text.split('\n')
  return {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: lines[lines.length - 1].length + 1,
  }
}
