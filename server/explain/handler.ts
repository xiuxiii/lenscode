import { LANGUAGES } from '../../src/data/languages.ts'
import { parseExplanationResponse } from '../../src/services/explanationProviders/httpProvider.ts'
import {
  ExplanationError,
  type ExplanationRequest,
  type SourceRange,
} from '../../src/types/explanation.ts'
import type { LanguageId } from '../../src/types/workspace.ts'
import type { LlmConfig } from './config.ts'
import { ExplainRouteError, requestCompletion } from './llmClient.ts'
import { buildMessages } from './prompt.ts'

/**
 * `POST /api/explain` — the backend half of `explainCode()`.
 *
 *   ExplanationRequest JSON  →  prompt  →  LLM  →  validated Explanation JSON
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

export function createExplainHandler({ config, log }: ExplainHandlerOptions) {
  return async function handleExplain(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json(405, { error: { code: 'unknown', message: 'Use POST.' } })
    }
    if (!config) {
      return errorResponse(
        new ExplainRouteError(
          'server_error',
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
      const explanationRequest = readRequest(body)

      const content = await requestCompletion(
        config,
        buildMessages(explanationRequest),
        request.signal,
      )

      let parsed: unknown
      try {
        parsed = extractJson(content)
      } catch {
        throw new ExplainRouteError(
          'invalid_response',
          502,
          'The model did not answer in the expected format. Try again.',
        )
      }

      // Same validation the browser applies; reject here so a bad answer is
      // reported as the model's fault with a 502 rather than reaching the UI.
      const explanation = parseExplanationResponse(parsed, explanationRequest)
      return json(200, explanation)
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
