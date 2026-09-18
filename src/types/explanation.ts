import type { LanguageId } from './workspace'

/**
 * A short label describing what kind of syntax the selection is.
 * Used for the small badge next to the selected code.
 */
export type ConceptKind =
  | 'keyword'
  | 'identifier'
  | 'call'
  | 'expression'
  | 'statement'
  | 'literal'
  | 'operator'
  | 'declaration'
  | 'element'
  | 'property'
  | 'selector'
  | 'type'

export interface RelatedConcept {
  /** Display label, e.g. "Promise". Also used as the lookup key when clicked. */
  label: string
  /** One-line teaser shown on hover / in the chip tooltip. */
  hint?: string
}

/**
 * The shape an explanation API is expected to return.
 * Visual components render this object and nothing else, so swapping the
 * mock provider for a real backend should not touch the UI.
 */
export interface Explanation {
  id: string
  selectedCode: string
  language: LanguageId
  /** Short human label, e.g. "Method call" or "Declaration keyword". */
  concept: string
  kind: ConceptKind
  /** WHAT IS IT? — one or two plain-language sentences. */
  simpleExplanation: string
  /** TECHNICAL DEFINITION — precise wording a reference manual would use. */
  definition: string
  /** IN THIS CODE — what the selection does in the surrounding source. */
  contextualExplanation: string
  /** WHY IS IT HERE? — the motivation for using it. */
  whyItExists: string
  /** RELATED CONCEPTS — what to learn next. */
  relatedConcepts: RelatedConcept[]
}

/** Zero-based-agnostic range in editor coordinates (1-based, like Monaco). */
export interface SourceRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

/**
 * Everything a backend would need to explain a selection in context.
 */
export interface ExplanationRequest {
  selectedCode: string
  language: LanguageId
  fullSource: string
  range: SourceRange | null
  fileName?: string
}

export type ExplanationErrorCode = 'not_found' | 'aborted' | 'unknown'

export class ExplanationError extends Error {
  code: ExplanationErrorCode
  constructor(code: ExplanationErrorCode, message: string) {
    super(message)
    this.name = 'ExplanationError'
    this.code = code
  }
}

/**
 * Contract for anything that can produce explanations: the local mock today,
 * an HTTP client talking to an LLM-backed endpoint later.
 */
export interface ExplanationProvider {
  /** Short label surfaced in the status bar. */
  readonly name: string
  explain(request: ExplanationRequest, signal?: AbortSignal): Promise<Explanation>
}
