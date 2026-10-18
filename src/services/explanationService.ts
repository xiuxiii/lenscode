import type {
  ExplainOptions,
  Explanation,
  ExplanationProvider,
  ExplanationRequest,
} from '../types/explanation'
import { createHttpExplanationProvider } from './explanationProviders/httpProvider'
import { mockExplanationProvider } from './explanationProviders/mockProvider'

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  The one door between the UI and whatever produces explanations.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Everything the app knows about explanations is `explainCode()` and the
 * `Explanation` type. The UI does not know which provider answers, whether
 * there is an HTTP call, what endpoint is used, how auth works, which model
 * runs, or how the prompt is built — and it must stay that way.
 *
 * No key:   explainCode() → mock provider (local catalog)
 * Key set:  explainCode() → HTTP provider → /api/explain (server/) → LLM
 *
 * Which one runs is decided by `VITE_EXPLANATION_API_URL`, which
 * `server/vitePlugin.ts` sets to `/api/explain` when the server has an
 * `LLM_API_KEY`. The key itself stays on the server and must never appear in
 * this directory or in any `VITE_`-prefixed variable, because everything Vite
 * inlines is public. See the "AI API Integration" section of the README.
 */

/** Same-origin path (or absolute URL) of the backend route, when one exists. */
const API_URL = import.meta.env.VITE_EXPLANATION_API_URL

function selectProvider(): ExplanationProvider {
  if (API_URL) {
    return createHttpExplanationProvider({ endpoint: API_URL, name: 'API' })
  }
  return mockExplanationProvider
}

const provider = selectProvider()

/**
 * Explain a piece of code.
 *
 * @param request  What to explain and the context it sits in.
 * @param options  `signal` cancels a superseded request.
 * @returns        A resolved `Explanation`.
 * @throws         `ExplanationError` with a code the panel can present —
 *                 never an unhandled rejection.
 */
export function explainCode(
  request: ExplanationRequest,
  options?: ExplainOptions,
): Promise<Explanation> {
  return provider.explain(request, options)
}

/** Label for the engine currently answering, shown in the status bar. */
export const explanationEngineName: string = provider.name

/** True while the app is answering from the local catalog rather than an API. */
export const isUsingMockExplanations: boolean = !API_URL
