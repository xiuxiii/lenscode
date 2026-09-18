import {
  MOCK_EXPLANATIONS,
  type MockExplanationEntry,
} from '../../data/mockExplanations'
import { normalizeSelection } from '../../lib/selection'
import {
  ExplanationError,
  type Explanation,
  type ExplanationProvider,
  type ExplanationRequest,
} from '../../types/explanation'

/**
 * The offline provider that ships today. It answers from the curated catalog
 * in `src/data/mockExplanations.ts`, simulates latency so the loading state is
 * exercised, and fails for selections it does not know so the error state is
 * exercised too.
 *
 * Nothing here is needed once a real LLM is connected — swap the provider in
 * `src/services/explanationService.ts` and this file can stay as the offline
 * fallback or be deleted.
 */

/** Candidate keys to try, from most to least specific. */
function candidateKeys(text: string): string[] {
  const base = normalizeSelection(text)
  const keys = new Set<string>([base])
  // Strip surrounding quotes: "/api/users" → /api/users
  const unquoted = base.replace(/^(["'`])(.*)\1$/, '$2')
  keys.add(unquoted)
  // Strip a leading dot from member access: .json() → json()
  keys.add(unquoted.replace(/^\./, ''))
  // Strip trailing call parens: fetch() → fetch
  keys.add(unquoted.replace(/\(\)$/, ''))
  // Strip a trailing "{" for lines like "async function x() {"
  keys.add(unquoted.replace(/\s*\{$/, ''))
  return [...keys].filter(Boolean)
}

function entryMatches(entry: MockExplanationEntry, key: string): boolean {
  return entry.match.some((m) => m.toLowerCase() === key)
}

function findEntry(request: ExplanationRequest): MockExplanationEntry | null {
  const keys = candidateKeys(request.selectedCode)
  const languageSpecific = MOCK_EXPLANATIONS.filter((e) =>
    e.languages?.includes(request.language),
  )
  const generic = MOCK_EXPLANATIONS.filter((e) => !e.languages)
  for (const key of keys) {
    const hit = languageSpecific.find((e) => entryMatches(e, key))
    if (hit) return hit
  }
  for (const key of keys) {
    const hit = generic.find((e) => entryMatches(e, key))
    if (hit) return hit
  }
  // Last resort: an entry for another language with the exact same key
  // (e.g. "await" selected while the language is set to Python).
  for (const key of keys) {
    const hit = MOCK_EXPLANATIONS.find((e) => entryMatches(e, key))
    if (hit) return hit
  }
  return null
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ExplanationError('aborted', 'Request cancelled'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new ExplanationError('aborted', 'Request cancelled'))
      },
      { once: true },
    )
  })
}

let idCounter = 0

export const mockExplanationProvider: ExplanationProvider = {
  name: 'Local mock',
  async explain(request, options) {
    await wait(550 + Math.random() * 400, options?.signal)
    const entry = findEntry(request)
    if (!entry) {
      throw new ExplanationError(
        'not_found',
        'No explanation is available for this selection yet.',
      )
    }
    const { match: _match, languages: _languages, ...body } = entry
    const explanation: Explanation = {
      id: `exp_${Date.now()}_${idCounter++}`,
      selectedCode: request.selectedCode.trim(),
      language: request.language,
      ...body,
    }
    return explanation
  },
}
