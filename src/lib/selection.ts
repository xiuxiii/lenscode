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
