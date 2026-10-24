import type { LanguageId } from './workspace.ts'

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
 * The shape an explanation API is expected to return: the contract between
 * the explanation service and the explanation panel.
 *
 * Visual components render this object and nothing else, so changing the
 * model or backend must not touch the UI.
 *
 * Canonical section names map onto these fields as follows — a backend is
 * free to use either vocabulary as long as the service layer returns *this*
 * one (see `src/services/parseExplanation.ts`):
 *
 *   title                 → concept
 *   whatIsIt              → simpleExplanation
 *   technicalDefinition   → definition
 *   inThisCode            → contextualExplanation
 *   whyItsHere            → whyItExists
 *   relatedConcepts[].name        → relatedConcepts[].label
 *   relatedConcepts[].explanation → relatedConcepts[].hint
 */
export interface Explanation {
  /** Unique per response. Used as a React key and to reset the follow-up box. */
  id: string
  /** Echo of the code that was explained, trimmed. */
  selectedCode: string
  language: LanguageId
  /** Short human label / title, e.g. "Method call" or "Declaration keyword". */
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
 * The code around the selection. This is what lets an answer be specific to
 * *this* file rather than generic: the full source of the active file, plus
 * where the selection sits inside it.
 */
export interface SurroundingContext {
  /** Full text of the file the selection came from. */
  fullSource: string
  /** Where the selection sits in `fullSource`, when it came from the editor. */
  range: SourceRange | null
}

/**
 * Reserved for project-level context (other files, dependencies, symbols).
 * Nothing populates this yet — it exists so adding project-wide intelligence
 * later is an additive change to the request rather than a new shape.
 */
export interface ProjectContext {
  /** Placeholder. Replace with real fields when project context is built. */
  readonly kind?: 'reserved'
}

/**
 * Everything the explanation service needs to explain a selection in context.
 * This is the single request shape; `explainCode()` accepts exactly this.
 */
export interface ExplanationRequest {
  /** The code the user highlighted (or a related-concept label). */
  selectedCode: string
  language: LanguageId
  surroundingContext: SurroundingContext
  /** Name of the file the selection came from, e.g. "fetchUsers.js". */
  fileName?: string
  /** Not populated yet. See `ProjectContext`. */
  projectContext?: ProjectContext
}

/** The parts of an explanation a follow-up question is asked about. */
export type ExplainedText = Pick<
  Explanation,
  'concept' | 'simpleExplanation' | 'definition' | 'contextualExplanation' | 'whyItExists'
>

/** One earlier question in a follow-up thread, and the answer it got. */
export interface FollowUpTurn {
  question: string
  answer: string
}

/**
 * A question about an explanation the reader has just seen. Carries the
 * original request (so the answer can use the same code and context), the
 * explanation itself, and the thread so far.
 */
export interface FollowUpRequest {
  request: ExplanationRequest
  explanation: ExplainedText
  /** Earlier questions and answers in this thread, oldest first. */
  previous: FollowUpTurn[]
  question: string
}

/**
 * Size limits for a follow-up request. The server rejects anything larger;
 * the browser trims to them before sending, so a thread never gets stuck.
 */
export const FOLLOW_UP_LIMITS = {
  /** Characters in a question. */
  questionChars: 2_000,
  /** Characters in each earlier answer, and in each explanation field. */
  textChars: 6_000,
  /** Earlier question/answer pairs the server accepts. */
  previousTurns: 10,
} as const

/** What `askFollowUp()` resolves to: plain text, with identifiers in "double quotes". */
export interface FollowUpAnswer {
  answer: string
}

/** Why an explanation failed; the panel shows a suggestion for each. */
export type ExplanationErrorCode =
  /** The server has no LLM_API_KEY. */
  | 'not_configured'
  /** Superseded by a newer request; never shown. */
  | 'aborted'
  | 'unknown'
  /** The request never reached the backend (offline, DNS, CORS). */
  | 'network'
  /** The backend or the model took too long. */
  | 'timeout'
  /** Too many requests — the caller should back off. */
  | 'rate_limited'
  /** The backend answered, but not with a usable `Explanation`. */
  | 'invalid_response'
  /** The backend answered with a 5xx. */
  | 'server_error'

export class ExplanationError extends Error {
  code: ExplanationErrorCode
  constructor(code: ExplanationErrorCode, message: string) {
    super(message)
    this.name = 'ExplanationError'
    this.code = code
  }
}

export interface ExplainOptions {
  /** Cancels an in-flight explanation (the UI aborts superseded requests). */
  signal?: AbortSignal
}
