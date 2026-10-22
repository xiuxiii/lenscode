import { useEffect, useRef } from 'react'
import type { FollowUp } from '../../hooks/useFollowUps'
import { renderProse } from '../../lib/prose'
import { AlertIcon, RetryIcon } from '../icons'

interface FollowUpThreadProps {
  followUps: FollowUp[]
  onRetry: (id: string) => void
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The questions asked about this explanation, each followed by its answer. */
export function FollowUpThread({ followUps, onRetry }: FollowUpThreadProps) {
  const latestRef = useRef<HTMLDivElement>(null)
  const latest = followUps.at(-1)

  // Bring a new question, and then its answer, into view from the top.
  useEffect(() => {
    latestRef.current?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [latest?.id, latest?.status])

  if (followUps.length === 0) return null

  return (
    <section className="follow-ups" aria-label="Follow-up questions" aria-live="polite">
      {followUps.map((item) => (
        <div
          key={item.id}
          className="follow-up"
          ref={item === latest ? latestRef : undefined}
          aria-busy={item.status === 'loading'}
        >
          <p className="follow-up__question">{item.question}</p>
          {item.status === 'loading' && (
            <div className="follow-up__loading" aria-label="Answering…">
              <span className="skeleton" style={{ width: '94%' }} />
              <span className="skeleton" style={{ width: '78%' }} />
              <span className="skeleton" style={{ width: '56%' }} />
            </div>
          )}
          {item.status === 'answered' &&
            item.answer?.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i} className="follow-up__answer">
                {renderProse(paragraph.trim())}
              </p>
            ))}
          {item.status === 'error' && (
            <div className="follow-up__error" role="alert">
              <AlertIcon className="follow-up__error-icon" />
              <p className="follow-up__error-message">
                {item.error?.message ?? 'Couldn’t answer this.'}
              </p>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onRetry(item.id)}
              >
                <RetryIcon />
                Retry
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
