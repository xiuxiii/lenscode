import { useCallback, useEffect, useReducer, useRef } from 'react'
import { explainCode, explanationEngineName } from '../services/explanationService'
import {
  ExplanationError,
  type Explanation,
  type ExplanationRequest,
} from '../types/explanation'

export type ExplanationStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface ExplanationState {
  status: ExplanationStatus
  /** The request currently being explained, or the last one attempted. */
  request: ExplanationRequest | null
  explanation: Explanation | null
  error: ExplanationError | null
  /** Most recent explanations first, capped. */
  history: Explanation[]
}

type Action =
  | { type: 'start'; request: ExplanationRequest }
  | { type: 'success'; explanation: Explanation }
  | { type: 'failure'; error: ExplanationError }
  | { type: 'reset' }

const HISTORY_LIMIT = 6

const initialState: ExplanationState = {
  status: 'idle',
  request: null,
  explanation: null,
  error: null,
  history: [],
}

function reducer(state: ExplanationState, action: Action): ExplanationState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        status: 'loading',
        request: action.request,
        error: null,
      }
    case 'success': {
      const history = [
        action.explanation,
        ...state.history.filter(
          (h) => h.selectedCode !== action.explanation.selectedCode,
        ),
      ].slice(0, HISTORY_LIMIT)
      return {
        ...state,
        status: 'loaded',
        explanation: action.explanation,
        error: null,
        history,
      }
    }
    case 'failure':
      return { ...state, status: 'error', error: action.error }
    case 'reset':
      return { ...initialState, history: state.history }
  }
}

export function useExplanation() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const controllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const explain = useCallback(
    async (request: ExplanationRequest) => {
      cancel()
      const controller = new AbortController()
      controllerRef.current = controller
      dispatch({ type: 'start', request })
      try {
        const explanation = await explainCode(request, {
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        dispatch({ type: 'success', explanation })
      } catch (err) {
        if (controller.signal.aborted) return
        // Anything the service failed to classify still reaches the panel as
        // a presentable error rather than an unhandled rejection.
        const error =
          err instanceof ExplanationError
            ? err
            : new ExplanationError(
                'unknown',
                err instanceof Error ? err.message : 'Something went wrong.',
              )
        if (error.code === 'aborted') return
        dispatch({ type: 'failure', error })
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    },
    [cancel],
  )

  const retry = useCallback(() => {
    if (state.request) void explain(state.request)
  }, [explain, state.request])

  const reset = useCallback(() => {
    cancel()
    dispatch({ type: 'reset' })
  }, [cancel])

  useEffect(() => cancel, [cancel])

  return {
    state,
    explain,
    retry,
    reset,
    providerName: explanationEngineName,
  }
}
