import {
  ExplanationError,
  type ConceptKind,
  type Explanation,
  type ExplanationRequest,
  type FollowUpAnswer,
  type RelatedConcept,
} from '../types/explanation.ts'

/**
 * Validates an explanation answer. Shared by the browser (on the API's
 * response) and the server (on the model's raw JSON), so a malformed or
 * truncated model answer never reaches — or crashes — the panel.
 *
 * Accepts the canonical section names or this app's internal field names:
 *
 *   { title, whatIsIt, technicalDefinition, inThisCode, whyItsHere,
 *     relatedConcepts: [{ name, explanation }] }
 */

const CONCEPT_KINDS: ConceptKind[] = [
  'keyword',
  'identifier',
  'call',
  'expression',
  'statement',
  'literal',
  'operator',
  'declaration',
  'element',
  'property',
  'selector',
  'type',
]

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

/** Accept either the canonical name or this app's internal one. */
function pick(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = str(body[key])
    if (value) return value
  }
  return null
}

function toRelatedConcepts(value: unknown): RelatedConcept[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') return str(item) ? [{ label: item }] : []
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const label = pick(record, 'name', 'label')
    if (!label) return []
    const hint = pick(record, 'explanation', 'hint')
    return [hint ? { label, hint } : { label }]
  })
}

/** Turn an arbitrary JSON body into an `Explanation`, or throw `invalid_response`. */
export function parseExplanationResponse(
  body: unknown,
  request: ExplanationRequest,
): Explanation {
  if (!body || typeof body !== 'object') {
    throw new ExplanationError(
      'invalid_response',
      'The explanation service returned an unexpected response.',
    )
  }
  const record = body as Record<string, unknown>
  const simpleExplanation = pick(record, 'whatIsIt', 'simpleExplanation')
  const definition = pick(record, 'technicalDefinition', 'definition')
  const contextualExplanation = pick(record, 'inThisCode', 'contextualExplanation')
  const whyItExists = pick(record, 'whyItsHere', 'whyItExists')

  if (!simpleExplanation || !definition || !contextualExplanation || !whyItExists) {
    throw new ExplanationError(
      'invalid_response',
      'The explanation service returned an incomplete explanation.',
    )
  }

  const rawKind = str(record.kind)
  const kind = CONCEPT_KINDS.includes(rawKind as ConceptKind)
    ? (rawKind as ConceptKind)
    : 'expression'

  return {
    id: str(record.id) ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    selectedCode: request.selectedCode.trim(),
    language: request.language,
    concept: pick(record, 'title', 'concept') ?? 'Explanation',
    kind,
    simpleExplanation,
    definition,
    contextualExplanation,
    whyItExists,
    relatedConcepts: toRelatedConcepts(record.relatedConcepts),
  }
}

/** Turn an arbitrary JSON body into a `FollowUpAnswer`, or throw `invalid_response`. */
export function parseFollowUpAnswer(body: unknown): FollowUpAnswer {
  const answer =
    body && typeof body === 'object' ? str((body as Record<string, unknown>).answer) : null
  if (!answer) {
    throw new ExplanationError(
      'invalid_response',
      'The answer came back empty or in an unexpected format.',
    )
  }
  return { answer: answer.trim() }
}
