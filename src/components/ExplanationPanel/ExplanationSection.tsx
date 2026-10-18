import type { ReactNode } from 'react'
import { renderProse } from '../../lib/prose'

interface ExplanationSectionProps {
  title: string
  children: ReactNode
}

/** A sentence-case heading over its body; whitespace, not lines, separates sections. */
export function ExplanationSection({ title, children }: ExplanationSectionProps) {
  return (
    <section className="panel-section">
      <h3 className="panel-section__title">{title}</h3>
      {typeof children === 'string' ? (
        <p className="panel-section__body">{renderProse(children)}</p>
      ) : (
        children
      )}
    </section>
  )
}
