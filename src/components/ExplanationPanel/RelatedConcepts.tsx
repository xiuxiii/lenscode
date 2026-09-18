import type { RelatedConcept } from '../../types/explanation'

interface RelatedConceptsProps {
  concepts: RelatedConcept[]
  onSelect: (concept: RelatedConcept) => void
}

export function RelatedConcepts({ concepts, onSelect }: RelatedConceptsProps) {
  if (concepts.length === 0) return null
  return (
    <ul className="related-concepts" aria-label="Related concepts">
      {concepts.map((concept) => (
        <li key={concept.label}>
          <button
            type="button"
            className="related-concepts__chip"
            title={concept.hint ? `${concept.hint} — click to explain` : 'Click to explain'}
            onClick={() => onSelect(concept)}
          >
            <code>{concept.label}</code>
          </button>
        </li>
      ))}
    </ul>
  )
}
