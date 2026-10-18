import type { RelatedConcept } from '../../types/explanation'
import { ArrowRightIcon } from '../icons'

interface RelatedConceptsProps {
  concepts: RelatedConcept[]
  onSelect: (label: string) => void
}

/** "What to learn next", as rows like a docs page's next links. */
export function RelatedConcepts({ concepts, onSelect }: RelatedConceptsProps) {
  return (
    <ul className="related" aria-label="Related concepts">
      {concepts.map((concept) => (
        <li key={concept.label}>
          <button
            type="button"
            className="related__row"
            onClick={() => onSelect(concept.label)}
            title={`Explain “${concept.label}”`}
          >
            <span className="related__name">{concept.label}</span>
            {concept.hint && <span className="related__hint">{concept.hint}</span>}
            <ArrowRightIcon size={14} className="related__arrow" />
          </button>
        </li>
      ))}
    </ul>
  )
}
