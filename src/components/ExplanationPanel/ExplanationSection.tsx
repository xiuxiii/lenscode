import type { ReactNode } from 'react'
import { renderProse } from '../../lib/prose'

interface ExplanationSectionProps {
  title: string
  children: ReactNode
  /** Visually emphasised section (used for "What is it?"). */
  emphasis?: boolean
}

export function ExplanationSection({ title, children, emphasis }: ExplanationSectionProps) {
  return (
    <section
      className={`explanation-section${emphasis ? ' explanation-section--emphasis' : ''}`}
    >
      <h3 className="explanation-section__title eyebrow">{title}</h3>
      <div className="explanation-section__body">
        {typeof children === 'string' ? <p>{renderProse(children)}</p> : children}
      </div>
    </section>
  )
}
