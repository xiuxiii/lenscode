import { useState, type FormEvent, type ReactNode } from 'react'
import type { ExplanationState } from '../../hooks/useExplanation'
import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import { normalizeSelection } from '../../lib/selection'
import type {
  Explanation,
  ExplanationErrorCode,
  RelatedConcept,
} from '../../types/explanation'
import type { CodeSelection, LanguageId } from '../../types/workspace'
import { getLanguage } from '../../data/languages'
import { AlertIcon, CursorTextIcon, RetryIcon, SendIcon } from '../icons'
import { LanguageIntro } from '../LanguageBadge/LanguageBadge'
import { ExplainButton } from '../SelectionActions/SelectionActions'
import { ExplanationSection } from './ExplanationSection'
import { RelatedConcepts } from './RelatedConcepts'
import './ExplanationPanel.css'

interface ExplanationPanelProps {
  state: ExplanationState
  selection: CodeSelection | null
  language: LanguageId
  onExplainSelection: () => void
  onExplainConcept: (label: string) => void
  onRetry: () => void
}

const KIND_LABEL: Record<Explanation['kind'], string> = {
  keyword: 'Keyword',
  identifier: 'Identifier',
  call: 'Call',
  expression: 'Expression',
  statement: 'Statement',
  literal: 'Literal',
  operator: 'Operator',
  declaration: 'Declaration',
  element: 'Element',
  property: 'Property',
  selector: 'Selector',
  type: 'Type',
}

function CodeChip({ code, language }: { code: string; language: LanguageId }) {
  const trimmed = code.trim()
  const multiline = trimmed.includes('\n')
  return (
    <div className={`code-chip${multiline ? ' code-chip--block' : ''}`}>
      <pre className="code-chip__code">{trimmed}</pre>
      <span className="code-chip__lang">{getLanguage(language).tag}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="panel-empty">
      <div className="panel-empty__icon">
        <CursorTextIcon size={20} />
      </div>
      <p className="panel-empty__title">Select some code to inspect it.</p>
      <p className="panel-empty__hint">
        Highlight a keyword, a name, a function call, or a whole line. Then press{' '}
        <kbd className="kbd">{EXPLAIN_SHORTCUT}</kbd> or click{' '}
        <strong>Explain</strong>.
      </p>
    </div>
  )
}

function SelectedState({
  selection,
  language,
  onExplain,
}: {
  selection: CodeSelection
  language: LanguageId
  onExplain: () => void
}) {
  return (
    <div className="panel-selected">
      <div className="panel-head">
        <span className="eyebrow">Selected</span>
        <CodeChip code={selection.text} language={language} />
      </div>
      <ExplainButton
        size="md"
        label="Explain this"
        showShortcut
        onClick={onExplain}
        className="panel-selected__button"
      />
      <p className="panel-selected__hint">
        You&rsquo;ll get a plain-language explanation, the precise definition, and
        why this code is here.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="panel-skeleton" aria-busy="true" aria-label="Generating explanation">
      {[3, 2, 4, 2].map((lines, section) => (
        <div className="panel-skeleton__section" key={section}>
          <div className="panel-skeleton__eyebrow" />
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="panel-skeleton__line"
              style={{ width: i === lines - 1 ? '55%' : `${88 - i * 6}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Every `ExplanationErrorCode` gets a suggestion, so a failure coming from a
 * real API is presented sensibly instead of always blaming the selection.
 */
const ERROR_HINT: Record<ExplanationErrorCode, string> = {
  not_found: 'Try selecting a smaller piece, like a single keyword or function call.',
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
      <div className="panel-error__icon">
        <AlertIcon size={16} />
      </div>
      <div className="panel-error__body">
        <p className="panel-error__title">We couldn&rsquo;t generate an explanation.</p>
        <p className="panel-error__message">{message}</p>
        <p className="panel-error__hint">{ERROR_HINT[code] ?? ERROR_HINT.unknown}</p>
        <button type="button" className="panel-error__retry" onClick={onRetry}>
          <RetryIcon size={13} />
          Retry
        </button>
      </div>
    </div>
  )
}

function LoadedState({
  explanation,
  onConcept,
}: {
  explanation: Explanation
  onConcept: (concept: RelatedConcept) => void
}) {
  return (
    <div className="panel-loaded" key={explanation.id}>
      <ExplanationSection title="What is it?" emphasis>
        {explanation.simpleExplanation}
      </ExplanationSection>
      <ExplanationSection title="Technical definition">
        {explanation.definition}
      </ExplanationSection>
      <ExplanationSection title="In this code">
        {explanation.contextualExplanation}
      </ExplanationSection>
      <ExplanationSection title="Why is it here?">
        {explanation.whyItExists}
      </ExplanationSection>
      <ExplanationSection title="Related concepts">
        <RelatedConcepts concepts={explanation.relatedConcepts} onSelect={onConcept} />
      </ExplanationSection>
    </div>
  )
}

function AskAboutThis({ explanation }: { explanation: Explanation | null }) {
  // State resets whenever the parent remounts this with a new `key`
  // (one per explanation), so no effect is needed.
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState<string | null>(null)

  const disabled = !explanation

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setAsked(q)
    setQuestion('')
  }

  return (
    <div className="panel-ask">
      {asked && (
        <div className="panel-ask__thread">
          <p className="panel-ask__question">{asked}</p>
          <p className="panel-ask__answer">
            Follow-up answers aren&rsquo;t available in this preview yet. The
            explanation engine will answer here once it&rsquo;s connected.
          </p>
        </div>
      )}
      <form className="panel-ask__form" onSubmit={submit}>
        <input
          className="panel-ask__input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            disabled ? 'Explain something to ask about it' : 'Ask about this…'
          }
          disabled={disabled}
          aria-label="Ask a follow-up question"
        />
        <button
          type="submit"
          className="panel-ask__send icon-button"
          disabled={disabled || !question.trim()}
          aria-label="Send question"
        >
          <SendIcon size={14} />
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
}: ExplanationPanelProps) {
  const { status, request, explanation, error } = state
  const hasSelection = Boolean(selection?.text.trim())

  const selectionIsNew =
    hasSelection &&
    selection &&
    (!request ||
      normalizeSelection(selection.text) !== normalizeSelection(request.selectedCode))

  let body: ReactNode
  if (status === 'idle') {
    body =
      hasSelection && selection ? (
        <SelectedState
          selection={selection}
          language={language}
          onExplain={onExplainSelection}
        />
      ) : (
        <EmptyState />
      )
  } else {
    body = (
      <>
        <div className="panel-head">
          <div className="panel-head__row">
            <span className="eyebrow">Explaining</span>
            {status === 'loaded' && explanation && (
              <span className="panel-head__kind" title={KIND_LABEL[explanation.kind]}>
                {explanation.concept}
              </span>
            )}
            {status === 'loading' && (
              <span className="panel-head__kind panel-head__kind--pending">
                Analysing…
              </span>
            )}
          </div>
          {request && <CodeChip code={request.selectedCode} language={request.language} />}
        </div>
        {status === 'loading' && <LoadingState />}
        {status === 'error' && (
          <ErrorState
            message={error?.message ?? 'Something went wrong.'}
            code={error?.code ?? 'unknown'}
            onRetry={onRetry}
          />
        )}
        {status === 'loaded' && explanation && (
          <LoadedState
            explanation={explanation}
            onConcept={(c) => onExplainConcept(c.label)}
          />
        )}
      </>
    )
  }

  return (
    <aside className="explanation-panel" aria-label="Explanation">
      {status !== 'idle' && selectionIsNew && selection && (
        <div className="panel-new-selection">
          <span className="panel-new-selection__label">New selection</span>
          <code className="panel-new-selection__code">
            {selection.text.replace(/\s+/g, ' ').trim()}
          </code>
          <ExplainButton onClick={onExplainSelection} />
        </div>
      )}
      <div className="explanation-panel__scroll">
        {/* Always say what language this is first — readers may not know. */}
        <LanguageIntro language={status === 'idle' || !request ? language : request.language} />
        {body}
      </div>
      <AskAboutThis
        key={status === 'loaded' && explanation ? explanation.id : 'none'}
        explanation={status === 'loaded' ? explanation : null}
      />
    </aside>
  )
}
