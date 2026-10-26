import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { getLanguage } from '../../data/languages'
import {
  formatDue,
  formatWait,
  nextDueAt,
  nextWait,
  toAnkiText,
  type Flashcard,
  type Rating,
} from '../../lib/flashcards'
import { renderProse } from '../../lib/prose'
import { AlertIcon, ArrowLeftIcon, CardsIcon, CheckIcon, DownloadIcon } from '../icons'
import './Flashcards.css'

interface FlashcardsProps {
  cards: Flashcard[]
  /** The cards due now, the longest-waiting first. */
  due: Flashcard[]
  now: number
  /** Saving failed, so the cards only last until the page is closed. */
  saveFailed: boolean
  /** Where the back button goes, e.g. "Back to the start screen". */
  backLabel: string
  onBack: () => void
  onRate: (id: string, rating: Rating) => void
  onDelete: (id: string) => void
}

/** The three answers, the key for each, and what each one means. */
const RATINGS: { rating: Rating; label: string; key: string; meaning: string }[] = [
  { rating: 'again', label: 'Again', key: '1', meaning: 'I didn’t remember it' },
  { rating: 'good', label: 'Good', key: '2', meaning: 'I remembered it' },
  { rating: 'easy', label: 'Easy', key: '3', meaning: 'I knew it straight away' },
]

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/** Code on one line, for the list. */
const oneLine = (code: string) => code.replace(/\s+/g, ' ').trim()

const shorten = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Keys typed into a field, held down or pressed with a modifier are not review shortcuts. */
function isShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false
  return !(
    e.target instanceof Element &&
    e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
  )
}

/** Download the cards as a text file Anki can import. */
function downloadForAnki(cards: Flashcard[]) {
  const blob = new Blob([toAnkiText(cards)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'lenscode-flashcards.txt'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked a moment later: straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

/** One due card at a time: the code, then the answer and how well it was remembered. */
function Review({ cards, due, now, onRate }: Pick<FlashcardsProps, 'cards' | 'due' | 'now' | 'onRate'>) {
  const current = due[0] ?? null
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const revealed = current !== null && revealedId === current.id
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  // Focus follows the review (on arrival, and after each step), so the keys
  // keep working and a screen reader reads what appeared. A card falling due
  // or one deleted from the list never moves it.
  const moveFocus = useRef(true)

  const reveal = useCallback(() => {
    if (!current) return
    moveFocus.current = true
    setRevealedId(current.id)
  }, [current])

  const answer = useCallback(
    (rating: Rating) => {
      if (!current) return
      moveFocus.current = true
      setRevealedId(null)
      onRate(current.id, rating)
    },
    [current, onRate],
  )

  const currentId = current?.id
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    const target = currentId ? (revealed ? backRef : frontRef) : messageRef
    target.current?.focus()
  }, [currentId, revealed])

  // Space shows the answer; 1, 2 and 3 answer it.
  useEffect(() => {
    if (!current) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isShortcut(e)) return
      if (!revealed) {
        // On a focused button, Space presses that button instead.
        if (e.key !== ' ' || (e.target instanceof Element && e.target.closest('button, a'))) return
        e.preventDefault()
        reveal()
        return
      }
      const choice = RATINGS.find((r) => r.key === e.key)
      if (!choice) return
      e.preventDefault()
      answer(choice.rating)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [current, revealed, reveal, answer])

  if (!current) {
    const next = nextDueAt(cards, now)
    return (
      <section className="review" aria-labelledby="review-title">
        <div className="review__message" ref={messageRef} tabIndex={-1}>
          {cards.length === 0 ? (
            <>
              <CardsIcon size={20} className="review__message-icon" />
              <h2 className="review__message-title" id="review-title">
                No flashcards yet
              </h2>
              <p className="review__message-body">
                Explain some code, then click “Save as flashcard” above the answer. Your cards
                show up here, ready to practise.
              </p>
            </>
          ) : (
            <>
              <CheckIcon size={20} className="review__message-icon" />
              <h2 className="review__message-title" id="review-title">
                All caught up
              </h2>
              {next !== null && (
                <p className="review__message-body">
                  The next card is due {formatDue(next, now)}.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="review" aria-labelledby="review-title">
      <h2 className="review__count" id="review-title">
        {plural(due.length, 'card')} to review
      </h2>
      <div className="review__front" ref={frontRef} tabIndex={-1}>
        <pre className="review__code">{current.code}</pre>
        {current.language !== 'plaintext' && (
          <p className="review__language">{getLanguage(current.language).label}</p>
        )}
      </div>

      {revealed ? (
        <>
          <div className="review__back" ref={backRef} tabIndex={-1}>
            <h3 className="review__concept">{current.concept}</h3>
            <p className="review__answer">{renderProse(current.simpleExplanation)}</p>
            <h4 className="review__section-title">In this code</h4>
            <p className="review__section-body">{renderProse(current.contextualExplanation)}</p>
          </div>
          <p className="review__question">How well did you remember it?</p>
          <div className="review__ratings">
            {RATINGS.map(({ rating, label, key, meaning }) => {
              const wait = formatWait(nextWait(current, rating))
              return (
                <button
                  key={rating}
                  type="button"
                  className="btn btn--secondary review__rate"
                  onClick={() => answer(rating)}
                  title={`${meaning}. See it again in ${wait} (${key})`}
                >
                  <span>{label}</span>{' '}
                  <span className="review__rate-wait">in {wait}</span>
                </button>
              )
            })}
          </div>
          <p className="review__keys">
            Or press <kbd className="kbd">1</kbd>, <kbd className="kbd">2</kbd> or{' '}
            <kbd className="kbd">3</kbd>
          </p>
        </>
      ) : (
        <>
          <p className="review__question">Can you remember what this does?</p>
          <button
            type="button"
            className="btn btn--primary review__show"
            onClick={reveal}
            title="Show the answer (Space)"
          >
            Show answer
          </button>
          <p className="review__keys">
            Or press <kbd className="kbd">Space</kbd>
          </p>
        </>
      )}
    </section>
  )
}

/** Every card, the next due first, each with a way to delete it. */
function CardList({
  cards,
  now,
  listRef,
  onDelete,
}: {
  cards: Flashcard[]
  now: number
  listRef: RefObject<HTMLUListElement | null>
  onDelete: (id: string, index: number) => void
}) {
  const sorted = useMemo(
    () => [...cards].sort((a, b) => a.due - b.due || a.createdAt - b.createdAt),
    [cards],
  )

  return (
    <section className="flashcards__section" aria-labelledby="card-list-title">
      <div className="flashcards__section-header">
        <h2 className="flashcards__section-title" id="card-list-title">
          All cards <span className="flashcards__section-count">{cards.length}</span>
        </h2>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => downloadForAnki(cards)}
          title="Download your cards as a file for Anki, a free flashcard app. In Anki, choose File, then Import."
        >
          <DownloadIcon />
          Export for Anki
        </button>
      </div>
      <ul className="card-list" ref={listRef}>
        {sorted.map((card, index) => (
          <li key={card.id} className="card-list__row">
            <span className="card-list__text">
              <code className="card-list__code" title={card.code}>
                {oneLine(card.code)}
              </code>
              <span className="card-list__concept">{card.concept}</span>
            </span>
            <span className="card-list__due">{formatDue(card.due, now)}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm card-list__delete"
              onClick={() => onDelete(card.id, index)}
              aria-label={`Delete the card for ${shorten(oneLine(card.code))}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The Flashcards screen: review what's due, see every card, export them for Anki. */
export function Flashcards({
  cards,
  due,
  now,
  saveFailed,
  backLabel,
  onBack,
  onRate,
  onDelete,
}: FlashcardsProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Keep keyboard focus in the list after a delete: on the card that took
  // its place (or the one before), or on the title once none are left.
  const deleteCard = (id: string, index: number) => {
    onDelete(id)
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('.card-list__delete')
      const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : null
      ;(next ?? titleRef.current)?.focus()
    })
  }

  return (
    <main className="flashcards">
      <div className="flashcards__inner">
        <button type="button" className="btn btn--ghost btn--sm flashcards__back" onClick={onBack}>
          <ArrowLeftIcon />
          <span className="flashcards__back-label">{backLabel}</span>
        </button>

        <header className="flashcards__hero">
          <h1 className="flashcards__title" ref={titleRef} tabIndex={-1}>
            Flashcards
          </h1>
          <p className="flashcards__lead">
            Explanations you saved, to practise until they stick. The better you know a card,
            the longer it waits before it comes back.
          </p>
        </header>

        {saveFailed && (
          <p className="flashcards__warning" role="alert">
            <AlertIcon className="flashcards__warning-icon" />
            This browser isn’t letting LensCode save, so these cards will be gone when you close
            the page.
          </p>
        )}

        <Review cards={cards} due={due} now={now} onRate={onRate} />
        {cards.length > 0 && (
          <CardList cards={cards} now={now} listRef={listRef} onDelete={deleteCard} />
        )}
      </div>
    </main>
  )
}
