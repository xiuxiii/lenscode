import type { ExplanationErrorCode } from '../../src/types/explanation.ts'
import type { LlmConfig } from './config.ts'
import type { ChatMessage } from './prompt.ts'

/**
 * Minimal client for an OpenAI-compatible `POST /chat/completions` endpoint
 * (DeepSeek by default). Uses the platform `fetch`; no SDK dependency.
 */

/** A failure with an HTTP status for our route and a message safe to show. */
export class ExplainRouteError extends Error {
  code: ExplanationErrorCode
  status: number
  constructor(code: ExplanationErrorCode, status: number, message: string) {
    super(message)
    this.name = 'ExplainRouteError'
    this.code = code
    this.status = status
  }
}

interface ChatCompletionResponse {
  choices?: {
    message?: { content?: string | null }
    finish_reason?: string | null
  }[]
}

/** Pull `error.message` out of an OpenAI-style error body, if there is one. */
async function upstreamMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } }
    const message = body?.error?.message
    return typeof message === 'string' ? message : ''
  } catch {
    return ''
  }
}

function errorForUpstream(status: number, detail: string, config: LlmConfig): ExplainRouteError {
  const suffix = detail ? ` (${detail})` : ''
  switch (status) {
    case 401:
    case 403:
      return new ExplainRouteError(
        'server_error',
        502,
        'The LLM provider rejected the API key. Check LLM_API_KEY in .env.local.',
      )
    case 402:
      return new ExplainRouteError(
        'server_error',
        502,
        'The LLM account is out of credit. Top up the balance with your provider.',
      )
    case 400:
    case 404:
    case 422:
      return new ExplainRouteError(
        'server_error',
        502,
        `The LLM provider rejected the request for model "${config.model}"${suffix}. Check LLM_MODEL.`,
      )
    case 429:
      return new ExplainRouteError(
        'rate_limited',
        429,
        'The LLM provider is rate-limiting requests. Wait a moment and try again.',
      )
    default:
      return new ExplainRouteError(
        'server_error',
        503,
        `The LLM provider is unavailable right now (HTTP ${status}). Try again shortly.`,
      )
  }
}

/**
 * Send the messages and return the assistant's raw text, which should be a
 * JSON object. `signal` aborts the upstream call when the browser gives up.
 */
export async function requestCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const timeout = AbortSignal.timeout(config.timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1500,
        stream: false,
      }),
      signal: combined,
    })
  } catch (err) {
    if (signal?.aborted) {
      throw new ExplainRouteError('aborted', 499, 'Request cancelled')
    }
    if (timeout.aborted) {
      throw new ExplainRouteError(
        'timeout',
        504,
        'The LLM took too long to answer. Try again, or select a smaller piece.',
      )
    }
    const reason = err instanceof Error && err.cause instanceof Error ? err.cause.message : ''
    throw new ExplainRouteError(
      'server_error',
      502,
      `Could not reach the LLM provider at ${config.baseUrl}${reason ? ` (${reason})` : ''}.`,
    )
  }

  if (!response.ok) {
    throw errorForUpstream(response.status, await upstreamMessage(response), config)
  }

  let data: ChatCompletionResponse
  try {
    data = (await response.json()) as ChatCompletionResponse
  } catch {
    throw new ExplainRouteError(
      'invalid_response',
      502,
      'The LLM provider returned a response that could not be read.',
    )
  }

  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'length') {
    throw new ExplainRouteError(
      'invalid_response',
      502,
      'The explanation was cut off before it finished. Try a smaller selection.',
    )
  }
  const content = choice?.message?.content?.trim()
  if (!content) {
    // JSON mode can occasionally yield an empty answer; a retry usually works.
    throw new ExplainRouteError(
      'invalid_response',
      502,
      'The model returned an empty answer. Try again.',
    )
  }
  return content
}
