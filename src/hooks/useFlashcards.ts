import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addCard,
  createCard,
  dueCards,
  findCard,
  FLASHCARDS_KEY,
  loadCards,
  removeCard,
  saveCards,
  schedule,
  type CardSource,
  type Flashcard,
  type Rating,
} from '../lib/flashcards'

/** How often "due" is checked again while there are cards, so one comes back on time. */
const TICK_MS = 30_000

/**
 * The flashcards saved in this browser, which of them are due, and what can
 * be done with them. Every change is saved straight away (see
 * `lib/flashcards`), and a change made in another tab shows up here too.
 */
export function useFlashcards() {
  const [cards, setCards] = useState<Flashcard[]>(() => loadCards())
  const [now, setNow] = useState(() => Date.now())
  /** The last save failed (storage blocked or full): the cards last only this visit. */
  const [saveFailed, setSaveFailed] = useState(false)
  // What storage holds already; only a change from it needs saving.
  const stored = useRef(cards)

  useEffect(() => {
    if (cards === stored.current) return
    stored.current = cards
    setSaveFailed(!saveCards(cards))
  }, [cards])

  // Another tab saved, answered or deleted cards.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== FLASHCARDS_KEY && e.key !== null) return
      const fresh = loadCards()
      stored.current = fresh
      setCards(fresh)
      setNow(Date.now())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const hasCards = cards.length > 0
  useEffect(() => {
    if (!hasCards) return
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [hasCards])

  const due = useMemo(() => dueCards(cards, now), [cards, now])

  /** Whether this explanation is saved as a card. */
  const isSaved = useCallback(
    (source: Pick<CardSource, 'selectedCode' | 'concept'>) =>
      findCard(cards, source.selectedCode, source.concept) !== undefined,
    [cards],
  )

  /** Save an explanation as a card, or remove its card if it is saved already. */
  const toggle = useCallback((source: CardSource) => {
    const time = Date.now()
    const card = createCard(source, time)
    setNow(time)
    setCards((prev) => {
      const saved = findCard(prev, card.code, card.concept)
      return saved ? removeCard(prev, saved.id) : addCard(prev, card)
    })
  }, [])

  const rate = useCallback((id: string, rating: Rating) => {
    const time = Date.now()
    setNow(time)
    setCards((prev) => prev.map((c) => (c.id === id ? schedule(c, rating, time) : c)))
  }, [])

  const remove = useCallback((id: string) => setCards((prev) => removeCard(prev, id)), [])

  return { cards, due, now, saveFailed, isSaved, toggle, rate, remove }
}
