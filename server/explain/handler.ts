import { LANGUAGES } from '../../src/data/languages.ts'
import {
  parseExplanationResponse,
  parseFollowUpAnswer,
} from '../../src/services/parseExplanation.ts'
import {
  ExplanationError,
  FOLLOW_UP_LIMITS,
  type ExplainedText,
  type ExplanationRequest,
  type FollowUpRequest,
  type FollowUpTurn,
  type SourceRange,
} from '../../src/types/explanation.ts'
import type { LanguageId } from '../../src/types/workspace.ts'
import type { LlmConfig } from './config.ts'
import { ExplainRouteError, requestCompletion } from './llmClient.ts'
import { buildFollowUpMessages, buildMessages } from './prompt.ts'

/**
 * `POST /api/explain` — the backend half of `explainCode()`.
 *
 *   ExplanationRequest JSON  →  prompt  →  LLM  →  validated Explanation JSON
 *
 * `POST /api/followup` — the backend half of `askFollowUp()`.
 *
 *   FollowUpRequest JSON  →  prompt  →  LLM  →  validated FollowUpAnswer JSON
 *
 * Written against the Web-standard `Request`/`Response`, so the same handler
 * can be mounted in Vite (see `server/vitePlugin.ts`) or exported from any
 * serverless runtime that speaks `fetch` (Vercel, Netlify, Cloudflare, …).
 *
 * Errors are returned as `{ error: { code, message } }`, where `code` is an
 * `ExplanationErrorCode` the panel already knows how to present.
 */

const MAX_SELECTION_CHARS = 8_000
const MAX_SOURCE_CHARS = 500_000
const {
  questionChars: MAX_QUESTION_CHARS,
  textChars: MAX_TEXT_CHARS,
  previousTurns: MAX_PREVIOUS_TURNS,
} = FOLLOW_UP_LIMITS
const LANGUAGE_IDS = new Set<string>(LANGUAGES.map((l) => l.id))

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function errorResponse(error: ExplainRouteError): Response {
  return json(error.status, { error: { code: error.code, message: error.message } })
}

function badRequest(message: string): ExplainRouteError {
  return new ExplainRouteError('unknown', 400, message)
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

function readRange(value: unknown): SourceRange | null {
  if (value === null || value === undefined) return null
  const r = value as Record<string, unknown>
  if (
    !isPositiveInt(r.startLine) ||
    !isPositiveInt(r.startColumn) ||
    !isPositiveInt(r.endLine) ||
    !isPositiveInt(r.endColumn)
  ) {
    throw badRequest('surroundingContext.range must be null or four positive integers.')
  }
  return {
    startLine: r.startLine,
    startColumn: r.startColumn,
    endLine: r.endLine,
    endColumn: r.endColumn,
  }
}

/** Accept only the documented request shape; everything else is a 400. */
function readRequest(body: unknown): ExplanationRequest {
  if (!body || typeof body !== 'object') throw badRequest('Expected a JSON object.')
  const b = body as Record<string, unknown>

  const selectedCode = b.selectedCode
  if (typeof selectedCode !== 'string' || !selectedCode.trim()) {
    throw badRequest('selectedCode must be a non-empty string.')
  }
  if (selectedCode.length > MAX_SELECTION_CHARS) {
    throw badRequest(
      `The selection is too long (over ${MAX_SELECTION_CHARS.toLocaleString()} characters). Select a smaller piece.`,
    )
  }

  if (typeof b.language !== 'string' || !LANGUAGE_IDS.has(b.language)) {
    throw badRequest('language is not a supported language id.')
  }

  const ctx = b.surroundingContext as Record<string, unknown> | undefined
  if (!ctx || typeof ctx !== 'object' || typeof ctx.fullSource !== 'string') {
    throw badRequest('surroundingContext.fullSource must be a string.')
  }
  if (ctx.fullSource.length > MAX_SOURCE_CHARS) {
    throw badRequest('The file is too large to send for an explanation.')
  }

  if (b.fileName !== undefined && typeof b.fileName !== 'string') {
    throw badRequest('fileName must be a string when present.')
  }

  return {
    selectedCode,
    language: b.language as LanguageId,
    fileName: b.fileName as string | undefined,
    surroundingContext: { fullSource: ctx.fullSource, range: readRange(ctx.range) },
    // projectContext is reserved and ignored until project context exists.
  }
}

function readText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} must be a non-empty string.`)
  }
  if (value.length > max) throw badRequest(`${field} is too long.`)
  return value
}

function readFollowUpRequest(body: unknown): FollowUpRequest {
  if (!body || typeof body !== 'object') throw badRequest('Expected a JSON object.')
  const b = body as Record<string, unknown>

  if (!b.request || typeof b.request !== 'object') {
    throw badRequest('request must be the explanation request the question is about.')
  }
  const request = readRequest(b.request)

  const e = b.explanation as Record<string, unknown> | undefined
  if (!e || typeof e !== 'object') throw badRequest('explanation must be an object.')
  const explanation: ExplainedText = {
    concept: readText(e.concept, 'explanation.concept', MAX_TEXT_CHARS),
    simpleExplanation: readText(e.simpleExplanation, 'explanation.simpleExplanation', MAX_TEXT_CHARS),
    definition: readText(e.definition, 'explanation.definition', MAX_TEXT_CHARS),
    contextualExplanation: readText(
      e.contextualExplanation,
      'explanation.contextualExplanation',
      MAX_TEXT_CHARS,
    ),
    whyItExists: readText(e.whyItExists, 'explanation.whyItExists', MAX_TEXT_CHARS),
  }

  if (!Array.isArray(b.previous)) throw badRequest('previous must be an array.')
  if (b.previous.length > MAX_PREVIOUS_TURNS) throw badRequest('previous has too many turns.')
  const previous: FollowUpTurn[] = b.previous.map((turn: unknown, i) => {
    const t = (turn ?? {}) as Record<string, unknown>
    return {
      question: readText(t.question, `previous[${i}].question`, MAX_QUESTION_CHARS),
      answer: readText(t.answer, `previous[${i}].answer`, MAX_TEXT_CHARS),
    }
  })

  const question = readText(b.question, 'question', MAX_QUESTION_CHARS)
  return { request, explanation, previous, question }
}

/**
 * Models in JSON mode return a bare object, but other OpenAI-compatible
 * models (e.g. self-hosted ones) sometimes wrap it in a ```json fence or add
 * a sentence around it. Take the outermost {...}.
 */
function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new SyntaxError('No JSON object found')
  return JSON.parse(text.slice(start, end + 1))
}

export interface ExplainHandlerOptions {
  /** `null` when `LLM_API_KEY` is missing. */
  config: LlmConfig | null
  /** Where to report upstream failures. Never receives the key. */
  log?: (message: string) => void
}

/**
 * The parts both routes share: POST only, a configured key, a JSON body, and
 * every failure mapped to `{ error: { code, message } }`. `answer` validates
 * the body, asks the model and returns the validated result.
 */
function createRoute(
  { config, log }: ExplainHandlerOptions,
  answer: (body: unknown, config: LlmConfig, signal: AbortSignal) => Promise<unknown>,
) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json(405, { error: { code: 'unknown', message: 'Use POST.' } })
    }
    if (!config) {
      return errorResponse(
        new ExplainRouteError(
          'not_configured',
          503,
          'No LLM_API_KEY is configured on the server. Add it to .env.local and restart.',
        ),
      )
    }

    try {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        throw badRequest('The request body is not valid JSON.')
      }
      return json(200, await answer(body, config, request.signal))
    } catch (err) {
      if (err instanceof ExplainRouteError) {
        if (err.code !== 'aborted' && err.status >= 500) log?.(`[explain] ${err.message}`)
        return errorResponse(err)
      }
      if (err instanceof ExplanationError) {
        log?.(`[explain] model answer rejected: ${err.message}`)
        return errorResponse(new ExplainRouteError(err.code, 502, err.message))
      }
      log?.(`[explain] unexpected error: ${err instanceof Error ? err.message : String(err)}`)
      return errorResponse(
        new ExplainRouteError('server_error', 500, 'Something went wrong on the server.'),
      )
    }
  }
}

/** The model's raw text as a JSON value, or a 502 the panel can show. */
function readModelJson(content: string): unknown {
  try {
    return extractJson(content)
  } catch {
    throw new ExplainRouteError(
      'invalid_response',
      502,
      'The model did not answer in the expected format. Try again.',
    )
  }
}

export function createExplainHandler(options: ExplainHandlerOptions) {
  return createRoute(options, async (body, config, signal) => {
    const explanationRequest = readRequest(body)
    const content = await requestCompletion(config, buildMessages(explanationRequest), signal)
    // Same validation the browser applies; reject here so a bad answer is
    // reported as the model's fault with a 502 rather than reaching the UI.
    return parseExplanationResponse(readModelJson(content), explanationRequest)
  })
}

export function createFollowUpHandler(options: ExplainHandlerOptions) {
  return createRoute(options, async (body, config, signal) => {
    const followUp = readFollowUpRequest(body)
    const content = await requestCompletion(config, buildFollowUpMessages(followUp), signal)
    return parseFollowUpAnswer(readModelJson(content))
  })
}
