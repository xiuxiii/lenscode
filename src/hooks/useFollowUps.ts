import { useCallback, useEffect, useRef, useState } from 'react'
import { askFollowUp } from '../services/explanationService'
import {
  ExplanationError,
  FOLLOW_UP_LIMITS,
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

/** Earlier turns sent with each question (the server accepts up to 10). */
const CONTEXT_TURNS = Math.min(6, FOLLOW_UP_LIMITS.previousTurns)

/** Keep earlier text within the server's limit, so one long answer can't block the thread. */
function clip(text: string, max: number = FOLLOW_UP_LIMITS.textChars): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

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
 * still on its way), including when the same explanation is shown again
 * later. One question is answered at a time.
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

  // A new explanation (or none) abandons the old thread and its pending
  // answer. Clearing it matters: an answer cancelled here never resolves, so
  // a kept thread would show it as loading forever if this explanation came
  // back (e.g. reopened from Recent).
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      setThread({ forId: null, items: [] })
    },
    [forId],
  )

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
              concept: clip(explanation.concept),
              simpleExplanation: clip(explanation.simpleExplanation),
              definition: clip(explanation.definition),
              contextualExplanation: clip(explanation.contextualExplanation),
              whyItExists: clip(explanation.whyItExists),
            },
            previous: previous.slice(-CONTEXT_TURNS).map((turn) => ({
              question: clip(turn.question, FOLLOW_UP_LIMITS.questionChars),
              answer: clip(turn.answer),
            })),
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
