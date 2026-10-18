import {
  ExplanationError,
  type ExplainOptions,
  type Explanation,
  type ExplanationErrorCode,
  type ExplanationRequest,
} from '../types/explanation'
import { parseExplanationResponse } from './parseExplanation'

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  The one door between the UI and whatever produces explanations.
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   explainCode() → POST /api/explain → server/explain → LLM provider
 *
 * Everything the UI knows about explanations is `explainCode()` and the
 * `Explanation` type. It does not know which model runs, how the prompt is
 * built or how auth works — none of that belongs in code shipped to the
 * browser, and the API key must never appear in this directory or in any
 * `VITE_`-prefixed variable (everything Vite inlines is public). See the
 * "AI API Integration" section of the README.
 */

/** Same-origin `/api/explain` by default; override only for a backend hosted elsewhere. */
const API_URL = import.meta.env.VITE_EXPLANATION_API_URL || '/api/explain'

/** Slightly longer than the server's own LLM timeout, so the server's clearer error wins. */
const TIMEOUT_MS = 45_000

const ERROR_CODES = new Set<ExplanationErrorCode>([
  'not_configured',
  'aborted',
  'unknown',
  'network',
  'timeout',
  'rate_limited',
  'invalid_response',
  'server_error',
])

/**
 * The backend reports failures as `{ error: { code, message } }`. Prefer its
 * wording (e.g. "the API key was rejected") over a generic status message.
 */
async function errorFromBody(response: Response): Promise<ExplanationError | null> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } }
    const message = body?.error?.message
    if (typeof message !== 'string' || !message.trim()) return null
    const code = body.error?.code as ExplanationErrorCode
    return new ExplanationError(ERROR_CODES.has(code) ? code : 'unknown', message)
  } catch {
    return null
  }
}

function errorForStatus(status: number): ExplanationError {
  if (status === 404) {
    return new ExplanationError(
      'server_error',
      'The explanation API route was not found. Is the backend running?',
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

/**
 * Explain a piece of code.
 *
 * @param request  What to explain and the context it sits in.
 * @param options  `signal` cancels a superseded request.
 * @returns        A validated `Explanation`.
 * @throws         `ExplanationError` with a code the panel can present —
 *                 never an unhandled rejection.
 */
export async function explainCode(
  request: ExplanationRequest,
  options?: ExplainOptions,
): Promise<Explanation> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  options?.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw (await errorFromBody(response)) ?? errorForStatus(response.status)
    }

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
      throw new ExplanationError('timeout', 'The explanation took too long. Try again.')
    }
    throw new ExplanationError(
      'network',
      'Could not reach the explanation service. Check your connection.',
    )
  } finally {
    clearTimeout(timer)
    options?.signal?.removeEventListener('abort', onAbort)
  }
}
