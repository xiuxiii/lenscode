import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { getLanguage } from '../../data/languages'
import type { ExplanationState } from '../../hooks/useExplanation'
import { useFollowUps } from '../../hooks/useFollowUps'
import { renderProse } from '../../lib/prose'
import { findRisks } from '../../lib/riskyCommands'
import { normalizeSelection } from '../../lib/selection'
import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import {
  FOLLOW_UP_LIMITS,
  type Explanation,
  type ExplanationErrorCode,
} from '../../types/explanation'
import type { CodeSelection, LanguageId } from '../../types/workspace'
import {
  AlertIcon,
  ArrowUpIcon,
  CardsIcon,
  CheckIcon,
  CursorTextIcon,
  RetryIcon,
} from '../icons'
import { ExplanationSection } from './ExplanationSection'
import { FollowUpThread } from './FollowUpThread'
import { RelatedConcepts } from './RelatedConcepts'
import './ExplanationPanel.css'

interface ExplanationPanelProps {
  state: ExplanationState
  selection: CodeSelection | null
  language: LanguageId
  onExplainSelection: () => void
  onExplainConcept: (label: string) => void
  onRetry: () => void
  /** Whether an explanation is saved as a flashcard. */
  isFlashcard: (explanation: Explanation) => boolean
  /** Save an explanation as a flashcard, or remove its card again. */
  onToggleFlashcard: (explanation: Explanation) => void
  /** Drag handle rendered above the header when the panel is a bottom sheet. */
  sheetHandle?: ReactNode
}

/** Selections this short (and on one line) are shown as a title; longer ones as a code block. */
const TITLE_MAX_CHARS = 32
const BLOCK_MAX_LINES = 6

/** What is being explained: the code as a title (or block), plus one line under it. */
function Subject({
  code,
  language,
  detail,
}: {
  code: string
  language: LanguageId
  detail: ReactNode
}) {
  const text = code.trim()
  const lines = text.split('\n')
  const asTitle = lines.length === 1 && text.length <= TITLE_MAX_CHARS
  const lang = getLanguage(language)
  return (
    <div className="subject">
      {asTitle ? (
        <h3 className="subject__title">{text}</h3>
      ) : (
        <pre
          className={`subject__code${lines.length > BLOCK_MAX_LINES ? ' subject__code--clipped' : ''}`}
        >
          {text}
        </pre>
      )}
      {detail}
      {language !== 'plaintext' && (
        <p className="subject__language">
          <span className="subject__language-name">{lang.label}</span> {lang.description}
        </p>
      )}
    </div>
  )
}

/**
 * Fixed warnings for commands that can destroy work, shown with the code.
 * The app decides these, never the AI, so nothing in the file being
 * explained can talk them away.
 */
function RiskWarning({ code }: { code: string }) {
  const risks = useMemo(() => findRisks(code), [code])
  if (risks.length === 0) return null
  return (
    <div className="risk" role="note" aria-label="Careful before running this">
      <AlertIcon className="risk__icon" />
      <div className="risk__body">
        <p className="risk__title">Careful before you run this</p>
        <ul className="risk__list">
          {risks.map((risk) => (
            <li key={risk.warning}>
              <code className="inline-code">{risk.match}</code> {risk.warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="panel-empty">
      <CursorTextIcon size={20} className="panel-empty__icon" />
      <p className="panel-empty__title">Highlight some code to explain it</p>
      <p className="panel-empty__hint">
        Drag across a keyword, a name, a call or a whole line, or double-click a word. It’s
        explained as soon as you let go.
      </p>
    </div>
  )
}

/** Mirrors the loaded layout: a lead pair, then three heading + body groups. */
function LoadingState() {
  return (
    <div className="panel-skeleton" aria-hidden="true">
      <div className="panel-skeleton__group">
        <span className="skeleton skeleton--lead" style={{ width: '92%' }} />
        <span className="skeleton skeleton--lead" style={{ width: '64%' }} />
      </div>
      {[0, 1, 2].map((group) => (
        <div className="panel-skeleton__group" key={group}>
          <span className="skeleton skeleton--heading" />
          <span className="skeleton" style={{ width: '96%' }} />
          <span className="skeleton" style={{ width: `${72 - group * 8}%` }} />
        </div>
      ))}
    </div>
  )
}

/** A next step for every `ExplanationErrorCode`, shown under the message. */
const ERROR_HINT: Record<ExplanationErrorCode, string> = {
  not_configured: 'LensCode needs an API key before it can explain code. The README shows where it goes.',
  aborted: 'The request was cancelled. Try again.',
  unknown: 'Try again in a moment.',
  network: 'Check your connection, then try again.',
  timeout: 'The service took too long. Try again, or select a smaller piece.',
  rate_limited: 'Wait a few seconds before asking for another explanation.',
  invalid_response: 'The explanation came back malformed. Try again.',
  server_error: 'The explanation service is having trouble. Try again shortly.',
}

function ErrorState({
  message,
  code,
  onRetry,
}: {
  message: string
  code: ExplanationErrorCode
  onRetry: () => void
}) {
  return (
    <div className="panel-error" role="alert">
      <AlertIcon size={20} className="panel-error__icon" />
      <p className="panel-error__title">Couldn’t explain this</p>
      <p className="panel-error__message">{message}</p>
      <p className="panel-error__hint">{ERROR_HINT[code] ?? ERROR_HINT.unknown}</p>
      <button type="button" className="btn btn--secondary panel-error__retry" onClick={onRetry}>
        <RetryIcon />
        Retry
      </button>
    </div>
  )
}

function LoadedState({
  explanation,
  onConcept,
  saved,
  onToggleSaved,
}: {
  explanation: Explanation
  onConcept: (label: string) => void
  /** Saved as a flashcard. */
  saved: boolean
  onToggleSaved: () => void
}) {
  return (
    <div className="panel-loaded">
      <div className={`panel-save${saved ? ' panel-save--saved' : ''}`}>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onToggleSaved}
          title={
            saved
              ? 'Saved to your flashcards. Click to remove it.'
              : 'Keep this as a flashcard to practise later'
          }
        >
          {saved ? <CheckIcon /> : <CardsIcon />}
          {saved ? 'Saved as flashcard' : 'Save as flashcard'}
        </button>
      </div>
      <p className="panel-lead">{renderProse(explanation.simpleExplanation)}</p>
      <ExplanationSection title="Technical definition">{explanation.definition}</ExplanationSection>
      <ExplanationSection title="In this code">{explanation.contextualExplanation}</ExplanationSection>
      <ExplanationSection title="Why it’s here">{explanation.whyItExists}</ExplanationSection>
      {explanation.relatedConcepts.length > 0 && (
        <ExplanationSection title="Related concepts">
          <RelatedConcepts concepts={explanation.relatedConcepts} onSelect={onConcept} />
        </ExplanationSection>
      )}
    </div>
  )
}

/** Follow-up box; only shown once there is an explanation to ask about. */
function AskComposer({ busy, onAsk }: { busy: boolean; onAsk: (question: string) => void }) {
  // State resets whenever the parent remounts this with a new `key`
  // (one per explanation), so no effect is needed.
  const [question, setQuestion] = useState('')
  const ready = question.trim().length > 0 && !busy

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    onAsk(question)
    setQuestion('')
  }

  return (
    <div className="panel-ask">
      <form className="composer" onSubmit={submit}>
        <input
          className="composer__input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a follow-up…"
          aria-label="Ask a follow-up question"
          maxLength={FOLLOW_UP_LIMITS.questionChars}
        />
        <button
          type="submit"
          className={`icon-btn composer__send${ready ? ' composer__send--ready' : ''}`}
          disabled={!ready}
          aria-label={busy ? 'Answering the last question…' : 'Send question'}
          title={busy ? 'Answering the last question…' : undefined}
        >
          <ArrowUpIcon />
        </button>
      </form>
    </div>
  )
}

export function ExplanationPanel({
  state,
  selection,
  language,
  onExplainSelection,
  onExplainConcept,
  onRetry,
  isFlashcard,
  onToggleFlashcard,
  sheetHandle,
}: ExplanationPanelProps) {
  const { status, request, explanation, error } = state
  const hasSelection = Boolean(selection?.text.trim())
  const loaded = status === 'loaded' && explanation ? explanation : null
  const { followUps, busy, ask, retry: retryFollowUp } = useFollowUps(loaded, request)

  const selectionIsNew =
    hasSelection &&
    selection &&
    (!request ||
      normalizeSelection(selection.text) !== normalizeSelection(request.selectedCode))

  let body: ReactNode
  if (status === 'idle' || !request) {
    body =
      hasSelection && selection ? (
        <>
          <Subject
            code={selection.text}
            language={language}
            detail={
              <p className="subject__detail subject__detail--hint">
                Press {EXPLAIN_SHORTCUT} or click Explain
              </p>
            }
          />
          <RiskWarning code={selection.text} />
        </>
      ) : (
        <EmptyState />
      )
  } else {
    const detail =
      status === 'loaded' && explanation ? (
        <p className="subject__detail">{explanation.concept}</p>
      ) : status === 'loading' ? (
        <span className="skeleton skeleton--detail" aria-hidden="true" />
      ) : null
    body = (
      <>
        <Subject code={request.selectedCode} language={request.language} detail={detail} />
        <RiskWarning code={request.selectedCode} />
        {status === 'loading' && <LoadingState />}
        {status === 'error' && (
          <ErrorState
            message={error?.message ?? 'Something went wrong.'}
            code={error?.code ?? 'unknown'}
            onRetry={onRetry}
          />
        )}
        {loaded && (
          <LoadedState
            explanation={loaded}
            onConcept={onExplainConcept}
            saved={isFlashcard(loaded)}
            onToggleSaved={() => onToggleFlashcard(loaded)}
          />
        )}
        {loaded && <FollowUpThread followUps={followUps} onRetry={retryFollowUp} />}
      </>
    )
  }

  const empty = status === 'idle' && !hasSelection

  return (
    <aside className="explanation-panel" aria-label="Explanation" aria-busy={status === 'loading'}>
      {sheetHandle}
      <header className="panel-header">
        <h2 className="panel-header__title">Explanation</h2>
        {status === 'loading' && <span className="panel-header__status">Explaining…</span>}
      </header>
      {status !== 'idle' && selectionIsNew && selection && (
        <div className="panel-new-selection">
          <span className="panel-new-selection__label">New selection:</span>
          <code className="panel-new-selection__code">
            {selection.text.replace(/\s+/g, ' ').trim()}
          </code>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onExplainSelection}
            title={`Explain the new selection (${EXPLAIN_SHORTCUT})`}
          >
            Explain
          </button>
        </div>
      )}
      <div
        className={`panel-scroll${empty ? ' panel-scroll--centered' : ''}`}
        // A new state or answer starts at the top, with a short fade.
        key={status === 'loaded' && explanation ? explanation.id : status}
      >
        {body}
      </div>
      {loaded && <AskComposer key={`ask:${loaded.id}`} busy={busy} onAsk={ask} />}
    </aside>
  )
}
