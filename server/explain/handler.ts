import { LANGUAGES } from '../../src/data/languages.ts'
import {
  parseExplanationResponse,
  parseFollowUpAnswer,
} from '../../src/services/parseExplanation.ts'
import {
  ExplanationError,
  FOLLOW_UP_LIMITS,
  type ExplainedText,
  type Explanation,
  type ExplanationRequest,
  type FollowUpRequest,
  type FollowUpTurn,
  type SourceRange,
} from '../../src/types/explanation.ts'
import type { LanguageId } from '../../src/types/workspace.ts'
import type { LlmConfig } from './config.ts'
import { ExplainRouteError, requestCompletion } from './llmClient.ts'
import { buildFollowUpMessages, buildMessages, type ChatMessage } from './prompt.ts'

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
 *
 * To keep costs down, a repeat explanation is answered from an in-memory
 * cache, and `LLM_DAILY_LIMIT` caps the AI calls made per day.
 */

/** Repeat explanations kept per handler, and for how long. */
const CACHE_ENTRIES = 200
const CACHE_TTL_MS = 60 * 60 * 1000

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
  /**
   * `null` when `LLM_API_KEY` is missing. Handlers built from the same config
   * share one count of AI calls against `dailyLimit`.
   */
  config: LlmConfig | null
  /** Where to report upstream failures. Never receives the key. */
  log?: (message: string) => void
}

/** AI calls made today, per config: the explain and follow-up routes share one count. */
const callsToday = new WeakMap<LlmConfig, { day: string; calls: number }>()

/**
 * Count one AI call against `LLM_DAILY_LIMIT`, or refuse it with a 429. The
 * count lives in this process and starts again at midnight, server time.
 */
function countCall(config: LlmConfig) {
  const limit = config.dailyLimit ?? 0
  if (limit <= 0) return
  const day = new Date().toDateString()
  let usage = callsToday.get(config)
  if (usage?.day !== day) {
    usage = { day, calls: 0 }
    callsToday.set(config, usage)
  }
  if (usage.calls >= limit) {
    const requests = limit === 1 ? 'AI request' : 'AI requests'
    throw new ExplainRouteError(
      'rate_limited',
      429,
      `LensCode's daily limit of ${limit} ${requests} is used up (LLM_DAILY_LIMIT). It resets at midnight.`,
    )
  }
  usage.calls++
}

/** Ask the model, counting the call against the daily limit. */
function complete(config: LlmConfig, messages: ChatMessage[], signal: AbortSignal) {
  countCall(config)
  return requestCompletion(config, messages, signal)
}

/**
 * A small in-memory cache. Entries expire after `ttlMs`; when it is full, the
 * one used least recently is dropped.
 */
function createCache<T>(maxEntries: number, ttlMs: number) {
  const entries = new Map<string, { value: T; expires: number }>()
  return {
    get(key: string): T | undefined {
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      if (entry.expires <= Date.now()) return undefined
      entries.set(key, entry) // now the most recently used
      return entry.value
    },
    set(key: string, value: T) {
      entries.delete(key)
      entries.set(key, { value, expires: Date.now() + ttlMs })
      if (entries.size > maxEntries) {
        const [oldest] = entries.keys()
        entries.delete(oldest)
      }
    },
  }
}

/** SHA-256 of the messages, as hex. Web Crypto, so it runs wherever `fetch` does. */
async function hashMessages(messages: ChatMessage[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(messages))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
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

/** What the model said about a selection, without one request's id and echo. */
type ModelAnswer = Omit<Explanation, 'id' | 'selectedCode' | 'language'>

export function createExplainHandler(options: ExplainHandlerOptions) {
  // The same code in the same context gets the same answer, so a repeat is
  // answered from memory: no AI call and no cost. The key is the exact
  // messages the model would see, which are already masked.
  const cache = createCache<ModelAnswer>(CACHE_ENTRIES, CACHE_TTL_MS)

  return createRoute(options, async (body, config, signal) => {
    const explanationRequest = readRequest(body)
    const messages = buildMessages(explanationRequest)
    const key = await hashMessages(messages)
    const cached = cache.get(key)
    // Parsed again for a fresh id and this request's own selection.
    if (cached) return parseExplanationResponse(cached, explanationRequest)

    const content = await complete(config, messages, signal)
    // Same validation the browser applies; reject here so a bad answer is
    // reported as the model's fault with a 502 rather than reaching the UI.
    const explanation = parseExplanationResponse(readModelJson(content), explanationRequest)
    const { id: _id, selectedCode: _selectedCode, language: _language, ...answer } = explanation
    cache.set(key, answer)
    return explanation
  })
}

/** Follow-ups are not cached: each one continues a different conversation. */
export function createFollowUpHandler(options: ExplainHandlerOptions) {
  return createRoute(options, async (body, config, signal) => {
    const followUp = readFollowUpRequest(body)
    const content = await complete(config, buildFollowUpMessages(followUp), signal)
    return parseFollowUpAnswer(readModelJson(content))
  })
}
