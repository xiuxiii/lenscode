import { useCallback, useEffect, useRef, useState } from 'react'
import { askFollowUp } from '../services/explanationService'
import {
  ExplanationError,
  type Explanation,
  type ExplanationRequest,
  type FollowUpTurn,
} from '../types/explanation'

/** One question in the thread, and where its answer is. */
export interface FollowUp {
  id: string
  question: string
  status: 'loading' | 'answered' | 'error'
  answer: string | null
  error: ExplanationError | null
}

/** Earlier turns sent with each question; the server accepts up to 10. */
const CONTEXT_TURNS = 6

const NO_FOLLOW_UPS: FollowUp[] = []

/** The answered turns before `index`, as context for the question at `index`. */
function answeredBefore(list: FollowUp[], index: number): FollowUpTurn[] {
  return list
    .slice(0, index)
    .flatMap((f) =>
      f.status === 'answered' && f.answer ? [{ question: f.question, answer: f.answer }] : [],
    )
}

/**
 * The follow-up questions asked about the explanation on screen. Showing a
 * different explanation starts a fresh, empty thread (and cancels an answer
 * still on its way). One question is answered at a time.
 */
export function useFollowUps(explanation: Explanation | null, request: ExplanationRequest | null) {
  const forId = explanation?.id ?? null
  const [thread, setThread] = useState<{ forId: string | null; items: FollowUp[] }>({
    forId,
    items: [],
  })
  const items = thread.forId === forId ? thread.items : NO_FOLLOW_UPS
  const controllerRef = useRef<AbortController | null>(null)
  const nextId = useRef(0)

  // A new explanation (or none) abandons the old thread's pending answer.
  useEffect(() => () => controllerRef.current?.abort(), [forId])

  const update = useCallback(
    (id: string, change: Partial<FollowUp>) =>
      setThread((prev) =>
        prev.forId === forId
          ? { forId, items: prev.items.map((f) => (f.id === id ? { ...f, ...change } : f)) }
          : prev,
      ),
    [forId],
  )

  const run = useCallback(
    async (item: FollowUp, previous: FollowUpTurn[]) => {
      if (!explanation || !request) return
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      try {
        const { answer } = await askFollowUp(
          {
            request,
            explanation: {
              concept: explanation.concept,
              simpleExplanation: explanation.simpleExplanation,
              definition: explanation.definition,
              contextualExplanation: explanation.contextualExplanation,
              whyItExists: explanation.whyItExists,
            },
            previous: previous.slice(-CONTEXT_TURNS),
            question: item.question,
          },
          { signal: controller.signal },
        )
        if (controller.signal.aborted) return
        update(item.id, { status: 'answered', answer, error: null })
      } catch (err) {
        if (controller.signal.aborted) return
        const error =
          err instanceof ExplanationError
            ? err
            : new ExplanationError('unknown', 'Something went wrong.')
        if (error.code === 'aborted') return
        update(item.id, { status: 'error', error })
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    },
    [explanation, request, update],
  )

  const ask = useCallback(
    (question: string) => {
      const text = question.trim()
      if (!text || !forId || items.some((f) => f.status === 'loading')) return
      const item: FollowUp = {
        id: `fu_${nextId.current++}`,
        question: text,
        status: 'loading',
        answer: null,
        error: null,
      }
      setThread({ forId, items: [...items, item] })
      void run(item, answeredBefore(items, items.length))
    },
    [forId, items, run],
  )

  const retry = useCallback(
    (id: string) => {
      const index = items.findIndex((f) => f.id === id)
      if (index === -1 || items.some((f) => f.status === 'loading')) return
      const item = { ...items[index], status: 'loading' as const, error: null }
      update(id, { status: 'loading', error: null })
      void run(item, answeredBefore(items, index))
    },
    [items, run, update],
  )

  return {
    followUps: items,
    busy: items.some((f) => f.status === 'loading'),
    ask,
    retry,
  }
}
