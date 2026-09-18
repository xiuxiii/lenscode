import type { ReactNode } from 'react'

/**
 * Renders inline "quoted" code inside prose: any text wrapped in double
 * quotes becomes a monospace chip so identifiers stand out from the sentence.
 */
export function renderProse(text: string): ReactNode[] {
  const parts = text.split(/("[^"]+")/g)
  return parts.map((part, i) => {
    if (part.startsWith('"') && part.endsWith('"') && part.length > 2) {
      return (
        <code key={i} className="inline-code">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}
