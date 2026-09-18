import {
  ExplanationError,
  type ConceptKind,
  type Explanation,
  type ExplanationProvider,
  type ExplanationRequest,
  type RelatedConcept,
} from '../../types/explanation'

/**
 * Talks to a backend route that this repository does not contain yet.
 *
 * It is deliberately provider-agnostic: there is no model name, no prompt, no
 * vendor SDK and no API key in this file, because none of those belong in
 * code that ships to the browser. All it does is POST the
 * `ExplanationRequest` to a same-origin route and validate what comes back.
 *
 *   browser → this file → POST {endpoint} → your backend → LLM provider
 *
 * It is inactive until `VITE_EXPLANATION_API_URL` is set (see
 * `src/services/explanationService.ts` and `.env.example`). That variable is
 * a path, never a secret — the key lives on the server.
 *
 * The backend is expected to answer 200 with a JSON body using either the
 * canonical section names or this app's internal field names:
 *
 *   { title, whatIsIt, technicalDefinition, inThisCode, whyItsHere,
 *     relatedConcepts: [{ name, explanation }] }
 */

const DEFAULT_TIMEOUT_MS = 30_000

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

export interface HttpProviderConfig {
  /** Same-origin path or absolute URL of the backend route. */
  endpoint: string
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number
  /** Label shown in the status bar. */
  name?: string
}

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

/**
 * Turn an arbitrary JSON body into an `Explanation`, or throw
 * `invalid_response`. This is the guard that keeps a malformed or truncated
 * model answer from reaching — and crashing — the panel.
 */
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

function errorForStatus(status: number): ExplanationError {
  if (status === 404) {
    return new ExplanationError(
      'not_found',
      'No explanation is available for this selection yet.',
    )
  }
  if (status === 429) {
    return new ExplanationError(
      'rate_limited',
      'Too many explanations at once. Wait a moment and try again.',
    )
  }
  if (status >= 500) {
    return new ExplanationError(
      'server_error',
      'The explanation service is unavailable right now.',
    )
  }
  return new ExplanationError(
    'unknown',
    `The explanation service rejected the request (${status}).`,
  )
}

export function createHttpExplanationProvider(
  config: HttpProviderConfig,
): ExplanationProvider {
  const { endpoint, timeoutMs = DEFAULT_TIMEOUT_MS, name = 'API' } = config

  return {
    name,
    async explain(request, options) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const onAbort = () => controller.abort()
      options?.signal?.addEventListener('abort', onAbort, { once: true })

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        if (!response.ok) throw errorForStatus(response.status)

        let body: unknown
        try {
          body = await response.json()
        } catch {
          throw new ExplanationError(
            'invalid_response',
            'The explanation service returned a response that could not be read.',
          )
        }
        return parseExplanationResponse(body, request)
      } catch (err) {
        if (err instanceof ExplanationError) throw err
        // The caller cancelled (new selection, unmount) vs. our own timeout.
        if (options?.signal?.aborted) {
          throw new ExplanationError('aborted', 'Request cancelled')
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new ExplanationError(
            'timeout',
            'The explanation took too long. Try again.',
          )
        }
        throw new ExplanationError(
          'network',
          'Could not reach the explanation service. Check your connection.',
        )
      } finally {
        clearTimeout(timer)
        options?.signal?.removeEventListener('abort', onAbort)
      }
    },
  }
}
