/**
 * Server-side LLM settings. Read from the environment of the process running
 * the API route (`.env.local` or the shell) — never from the browser bundle.
 *
 * Any OpenAI-compatible chat-completions API works. The defaults point at
 * DeepSeek, so `LLM_API_KEY` is the only value that has to be set.
 */

export const DEFAULT_LLM_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_LLM_MODEL = 'deepseek-chat'
const DEFAULT_TIMEOUT_MS = 40_000

export interface LlmConfig {
  apiKey: string
  /** Base URL of the OpenAI-compatible API, without a trailing slash. */
  baseUrl: string
  model: string
  /** Give up on the upstream call after this long. Kept below the client's timeout. */
  timeoutMs: number
  /** Most AI calls per day in this server process. 0 or absent: no limit. */
  dailyLimit?: number
}

type Env = Record<string, string | undefined>

/** `null` when no key is configured; the route then answers `not_configured`. */
export function readLlmConfig(env: Env): LlmConfig | null {
  const apiKey = env.LLM_API_KEY?.trim()
  if (!apiKey) return null
  const timeout = Number(env.LLM_TIMEOUT_MS)
  const dailyLimit = Number(env.LLM_DAILY_LIMIT)
  return {
    apiKey,
    baseUrl: (env.LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL).replace(/\/+$/, ''),
    model: env.LLM_MODEL?.trim() || DEFAULT_LLM_MODEL,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit >= 1 ? Math.floor(dailyLimit) : 0,
  }
}
