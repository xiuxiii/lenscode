import { getLanguage, LANGUAGES } from '../data/languages'
import type { Explanation } from '../types/explanation'
import type { LanguageId } from '../types/workspace'
import { normalizeSelection } from './selection'

/**
 * Flashcards made from explanations, and when to show each one again.
 *
 * A card's front is the explained code; its back is the concept, the plain
 * answer and what the code does where it was found. Reviews use a small
 * version of SM-2 (the scheme Anki grew from): each card has an interval in
 * days and an ease. "Good" multiplies the interval by the ease, "Easy" goes
 * further and raises the ease, and "Again" brings the card back in a few
 * minutes and lowers it.
 *
 * Scheduling is pure (every function takes `now`). Storage is separate: the
 * cards live in this browser's localStorage under one key, each one is
 * checked when read, and storage that is missing, blocked or full is never
 * an error, only no saving.
 */

export type Rating = 'again' | 'good' | 'easy'

export interface Flashcard {
  id: string
  /** Front: the explained code, trimmed, and its language. */
  code: string
  language: LanguageId
  /** Back: the concept title, the plain answer and "in this code". */
  concept: string
  simpleExplanation: string
  contextualExplanation: string
  /** When it was saved, in ms since the epoch. */
  createdAt: number
  /** When it is next due for review, in ms. A new card is due straight away. */
  due: number
  /** Whole days until `due`, from the last answer. 0 for a new card, and after Again. */
  interval: number
  /** How fast the interval grows. Starts at 2.5, never below 1.3. */
  ease: number
}

/** The parts of an explanation a card is made from. */
export type CardSource = Pick<
  Explanation,
  'selectedCode' | 'language' | 'concept' | 'simpleExplanation' | 'contextualExplanation'
>

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const START_EASE = 2.5
const MIN_EASE = 1.3
/** Again: back in a few minutes, and a little harder from then on. */
const AGAIN_DELAY_MS = 5 * MINUTE_MS
const AGAIN_EASE_DROP = 0.2
/** Easy: the first wait in days, the stretch beyond Good, and the ease gained. */
const EASY_FIRST_DAYS = 4
const EASY_BONUS = 1.3
const EASY_EASE_GAIN = 0.15
/** Even a card that is known well comes back once a year. */
const MAX_INTERVAL_DAYS = 365

const newId = (now: number) => `card_${now}_${Math.random().toString(36).slice(2, 8)}`

/** Same code (compared the way the editor compares selections) and same concept: one card. */
function cardKey(code: string, concept: string): string {
  return `${normalizeSelection(code)}\n${concept.trim().toLowerCase()}`
}

// ─────────────────────────── Cards ───────────────────────────

/** A new card for an explanation, due straight away. */
export function createCard(source: CardSource, now: number, id = newId(now)): Flashcard {
  return {
    id,
    code: source.selectedCode.trim(),
    language: source.language,
    concept: source.concept.trim(),
    simpleExplanation: source.simpleExplanation,
    contextualExplanation: source.contextualExplanation,
    createdAt: now,
    due: now,
    interval: 0,
    ease: START_EASE,
  }
}

/** The saved card for this code and concept, if there is one. */
export function findCard(cards: Flashcard[], code: string, concept: string): Flashcard | undefined {
  const key = cardKey(code, concept)
  return cards.find((c) => cardKey(c.code, c.concept) === key)
}

/** `cards` with `card` added, unless a card for the same code and concept is already there. */
export function addCard(cards: Flashcard[], card: Flashcard): Flashcard[] {
  return findCard(cards, card.code, card.concept) ? cards : [...cards, card]
}

export function removeCard(cards: Flashcard[], id: string): Flashcard[] {
  return cards.filter((c) => c.id !== id)
}

// ─────────────────────────── Scheduling ───────────────────────────

/** Days until the card is due again after this answer. 0 for Again (it is back in minutes). */
export function nextInterval(card: Pick<Flashcard, 'interval' | 'ease'>, rating: Rating): number {
  if (rating === 'again') return 0
  const { interval, ease } = card
  const good = interval === 0 ? 1 : Math.max(interval + 1, Math.round(interval * ease))
  const days =
    rating === 'good'
      ? good
      : interval === 0
        ? EASY_FIRST_DAYS
        : Math.max(good + 1, Math.round(interval * ease * EASY_BONUS))
  return Math.min(days, MAX_INTERVAL_DAYS)
}

/** How long until the card is back after this answer, in ms. Shown on the answer buttons. */
export function nextWait(card: Pick<Flashcard, 'interval' | 'ease'>, rating: Rating): number {
  return rating === 'again' ? AGAIN_DELAY_MS : nextInterval(card, rating) * DAY_MS
}

/** The card after it was answered with `rating` at `now`. */
export function schedule(card: Flashcard, rating: Rating, now: number): Flashcard {
  const ease =
    rating === 'again'
      ? Math.max(MIN_EASE, card.ease - AGAIN_EASE_DROP)
      : rating === 'easy'
        ? card.ease + EASY_EASE_GAIN
        : card.ease
  return {
    ...card,
    interval: nextInterval(card, rating),
    // Rounded so repeated steps don't drift (2.3 - 0.2 is 2.0999…).
    ease: Math.round(ease * 100) / 100,
    due: now + nextWait(card, rating),
  }
}

/** The cards due at `now`, the longest-waiting first. */
export function dueCards(cards: Flashcard[], now: number): Flashcard[] {
  return cards
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due || a.createdAt - b.createdAt)
}

/** When the next card that isn't due yet will be, or null if none is waiting. */
export function nextDueAt(cards: Flashcard[], now: number): number | null {
  let next: number | null = null
  for (const card of cards) {
    if (card.due > now && (next === null || card.due < next)) next = card.due
  }
  return next
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** A wait in words: "5 minutes", "3 hours", "4 days", "2 months", "1 year". */
export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS))
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.round(ms / HOUR_MS)
  if (hours < 24) return plural(hours, 'hour')
  const days = Math.round(ms / DAY_MS)
  if (days < 31) return plural(days, 'day')
  const months = Math.round(days / 30.4)
  if (months < 12) return plural(months, 'month')
  return plural(Math.round(days / 365), 'year')
}

/** When a card is due, for a list: "Due now" or "in 3 days". */
export function formatDue(due: number, now: number): string {
  return due <= now ? 'Due now' : `in ${formatWait(due - now)}`
}

// ─────────────────────────── Anki export ───────────────────────────

/** Text as one HTML field on one line: a tab or a line break would split the card. */
function ankiField(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\r\n?|\n/g, '<br>')
}

/**
 * The cards as a text file Anki can import (File → Import): one card per
 * line, front and back separated by a tab. The two header lines tell Anki
 * so, and that the fields are HTML, which keeps the code's line breaks and
 * indentation (inside `<pre>`, left-aligned on Anki's centred cards).
 */
export function toAnkiText(cards: Flashcard[]): string {
  const lines = cards.map((card) => {
    const language =
      card.language === 'plaintext'
        ? ''
        : `<br><small>${ankiField(getLanguage(card.language).label)}</small>`
    const front = `<pre style='display:inline-block;text-align:left'>${ankiField(card.code)}</pre>${language}`
    const back = [
      `<b>${ankiField(card.concept)}</b>`,
      ankiField(card.simpleExplanation),
      `<i>In this code:</i> ${ankiField(card.contextualExplanation)}`,
    ].join('<br><br>')
    return `${front}\t${back}`
  })
  return ['#separator:tab', '#html:true', ...lines].join('\n') + '\n'
}

// ─────────────────────────── Storage (localStorage) ───────────────────────────

export const FLASHCARDS_KEY = 'lenscode:flashcards'
/** Bump when the saved shape changes incompatibly; older saves are ignored. */
const SCHEMA = 1

/** The part of `Storage` the cards use, so tests can pass a stand-in. */
export type CardStorage = Pick<Storage, 'getItem' | 'setItem'>

/** This browser's localStorage, or null where there is none or it is blocked. */
export function browserStorage(): CardStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Even reading `localStorage` throws when the browser blocks site data.
    return null
  }
}

const LANGUAGE_IDS = new Set<string>(LANGUAGES.map((l) => l.id))
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A stored card, or null if it isn't one. An unknown language becomes plain text. */
function readCard(value: unknown): Flashcard | null {
  const c = value as Partial<Flashcard> | null
  if (
    !c ||
    typeof c !== 'object' ||
    !isString(c.id) ||
    !c.id ||
    !isString(c.code) ||
    !c.code.trim() ||
    !isString(c.concept) ||
    !isString(c.simpleExplanation) ||
    !isString(c.contextualExplanation) ||
    !isNumber(c.createdAt) ||
    !isNumber(c.due) ||
    !isNumber(c.interval) ||
    !isNumber(c.ease)
  ) {
    return null
  }
  return {
    id: c.id,
    code: c.code,
    language: isString(c.language) && LANGUAGE_IDS.has(c.language) ? c.language : 'plaintext',
    concept: c.concept,
    simpleExplanation: c.simpleExplanation,
    contextualExplanation: c.contextualExplanation,
    createdAt: c.createdAt,
    due: c.due,
    interval: Math.min(MAX_INTERVAL_DAYS, Math.max(0, Math.round(c.interval))),
    ease: Math.max(MIN_EASE, c.ease),
  }
}

/** The cards saved in this browser. None if nothing is saved or it can't be read. */
export function loadCards(storage: CardStorage | null = browserStorage()): Flashcard[] {
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(FLASHCARDS_KEY) ?? 'null') as {
      schema?: unknown
      cards?: unknown
    } | null
    if (!raw || raw.schema !== SCHEMA || !Array.isArray(raw.cards)) return []
    // Bad entries are skipped, and so is a second card with the same id or content.
    const ids = new Set<string>()
    const keys = new Set<string>()
    const cards: Flashcard[] = []
    for (const item of raw.cards) {
      const card = readCard(item)
      if (!card) continue
      const key = cardKey(card.code, card.concept)
      if (ids.has(card.id) || keys.has(key)) continue
      ids.add(card.id)
      keys.add(key)
      cards.push(card)
    }
    return cards
  } catch {
    return []
  }
}

/** Save the cards in this browser. False when storage is missing, blocked or full. */
export function saveCards(cards: Flashcard[], storage: CardStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(FLASHCARDS_KEY, JSON.stringify({ schema: SCHEMA, cards }))
    return true
  } catch {
    return false
  }
}
