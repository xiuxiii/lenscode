import { afterEach, describe, expect, it } from 'vitest'
import {
  addCard,
  browserStorage,
  createCard,
  dueCards,
  findCard,
  FLASHCARDS_KEY,
  formatDue,
  formatWait,
  loadCards,
  nextDueAt,
  nextInterval,
  nextWait,
  removeCard,
  saveCards,
  schedule,
  toAnkiText,
  type CardSource,
  type CardStorage,
  type Flashcard,
  type Rating,
} from './flashcards'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0)

const SOURCE: CardSource = {
  selectedCode: '  const total = items.reduce((sum, x) => sum + x, 0)\n',
  language: 'javascript',
  concept: ' Array reduce ',
  simpleExplanation: 'It adds up every number in the list.',
  contextualExplanation: 'Here it totals the "items" prices.',
}

function card(overrides: Partial<Flashcard> = {}): Flashcard {
  return { ...createCard(SOURCE, NOW, 'card_1'), ...overrides }
}

/** A Map-backed stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}): CardStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  }
}

const stored = (value: unknown) => memoryStorage({ [FLASHCARDS_KEY]: JSON.stringify(value) })

/** Answer a card several times in a row, a day apart. */
function answer(start: Flashcard, ratings: Rating[]): Flashcard {
  return ratings.reduce((c, rating, i) => schedule(c, rating, NOW + i * DAY), start)
}

describe('createCard', () => {
  it('keeps the trimmed code and its language on the front, and the answer on the back', () => {
    expect(createCard(SOURCE, NOW, 'card_1')).toEqual({
      id: 'card_1',
      code: 'const total = items.reduce((sum, x) => sum + x, 0)',
      language: 'javascript',
      concept: 'Array reduce',
      simpleExplanation: 'It adds up every number in the list.',
      contextualExplanation: 'Here it totals the "items" prices.',
      createdAt: NOW,
      due: NOW,
      interval: 0,
      ease: 2.5,
    })
  })

  it('makes a fresh id when none is given', () => {
    const a = createCard(SOURCE, NOW)
    const b = createCard(SOURCE, NOW)
    expect(a.id).toMatch(/^card_/)
    expect(a.id).not.toBe(b.id)
  })
})

describe('saving the same card twice', () => {
  it('finds a card by its code and concept', () => {
    const cards = [card()]
    expect(findCard(cards, SOURCE.selectedCode, SOURCE.concept)?.id).toBe('card_1')
    expect(findCard(cards, SOURCE.selectedCode, 'Something else')).toBeUndefined()
  })

  it('ignores spacing, a trailing semicolon and case, like the editor does', () => {
    const cards = [card()]
    const again = createCard(
      {
        ...SOURCE,
        selectedCode: 'const total =\n  items.reduce((sum, x) => sum + x, 0);',
        concept: 'array REDUCE',
      },
      NOW + DAY,
      'card_2',
    )
    expect(addCard(cards, again)).toBe(cards)
  })

  it('adds a card for the same code with a different concept', () => {
    const other = createCard({ ...SOURCE, concept: 'Arrow function' }, NOW, 'card_2')
    expect(addCard([card()], other).map((c) => c.id)).toEqual(['card_1', 'card_2'])
  })

  it('removes a card by id', () => {
    const other = createCard({ ...SOURCE, selectedCode: 'sum + x' }, NOW, 'card_2')
    expect(removeCard([card(), other], 'card_1')).toEqual([other])
  })
})

describe('schedule', () => {
  it('Good: one day the first time, then the interval times the ease', () => {
    const intervals: number[] = []
    let c = card()
    for (let i = 0; i < 5; i++) {
      c = schedule(c, 'good', NOW)
      intervals.push(c.interval)
    }
    expect(intervals).toEqual([1, 3, 8, 20, 50])
    expect(c.ease).toBe(2.5)
    expect(c.due).toBe(NOW + 50 * DAY)
  })

  it('Again: back in a few minutes, a little harder, and starts over', () => {
    const learned = answer(card(), ['good', 'good'])
    const missed = schedule(learned, 'again', NOW)
    expect(missed.due).toBe(NOW + 5 * MINUTE)
    expect(missed.interval).toBe(0)
    expect(missed.ease).toBe(2.3)
    expect(schedule(missed, 'good', NOW).interval).toBe(1)
  })

  it('Again never takes the ease below 1.3', () => {
    const c = answer(card(), Array<Rating>(10).fill('again'))
    expect(c.ease).toBe(1.3)
  })

  it('Easy: four days the first time, longer than Good after that, and easier', () => {
    const first = schedule(card(), 'easy', NOW)
    expect(first.interval).toBe(4)
    expect(first.due).toBe(NOW + 4 * DAY)
    expect(first.ease).toBe(2.65)
    expect(schedule(card({ interval: 3 }), 'easy', NOW).interval).toBe(10)
  })

  it('Easy always waits longer than Good, and Good longer than Again', () => {
    for (const interval of [0, 1, 2, 5, 13, 40]) {
      for (const ease of [1.3, 1.9, 2.5, 3.1]) {
        const c = card({ interval, ease })
        expect(nextWait(c, 'easy')).toBeGreaterThan(nextWait(c, 'good'))
        expect(nextWait(c, 'good')).toBeGreaterThan(nextWait(c, 'again'))
      }
    }
  })

  it('always grows the interval by at least a day, even at the lowest ease', () => {
    expect(nextInterval(card({ interval: 1, ease: 1.3 }), 'good')).toBe(2)
    expect(nextInterval(card({ interval: 2, ease: 1.3 }), 'good')).toBe(3)
  })

  it('brings even a well-known card back within a year', () => {
    const c = card({ interval: 300, ease: 2.5 })
    expect(nextInterval(c, 'good')).toBe(365)
    expect(nextInterval(c, 'easy')).toBe(365)
  })

  it('keeps the ease free of rounding drift', () => {
    expect(answer(card(), ['again', 'again', 'again']).ease).toBe(1.9)
  })

  it('leaves the card it was given alone', () => {
    const c = card()
    schedule(c, 'easy', NOW)
    expect(c).toEqual(card())
  })
})

describe('due cards', () => {
  const a = card({ id: 'a', due: NOW - DAY, createdAt: NOW - 3 * DAY })
  const b = card({ id: 'b', due: NOW - 5 * MINUTE, createdAt: NOW - 2 * DAY })
  const c = card({ id: 'c', due: NOW, createdAt: NOW - DAY })
  const later = card({ id: 'later', due: NOW + 3 * DAY })
  const soon = card({ id: 'soon', due: NOW + 10 * MINUTE })

  it('picks the cards due by now, the longest-waiting first', () => {
    expect(dueCards([later, c, a, soon, b], NOW).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('puts the older card first when two are due at the same moment', () => {
    const older = card({ id: 'older', due: NOW, createdAt: NOW - DAY })
    const newer = card({ id: 'newer', due: NOW, createdAt: NOW })
    expect(dueCards([newer, older], NOW).map((x) => x.id)).toEqual(['older', 'newer'])
  })

  it('has nothing due when every card is waiting', () => {
    expect(dueCards([later, soon], NOW)).toEqual([])
  })

  it('says when the next waiting card is due', () => {
    expect(nextDueAt([a, later, soon], NOW)).toBe(NOW + 10 * MINUTE)
    expect(nextDueAt([a, b], NOW)).toBeNull()
    expect(nextDueAt([], NOW)).toBeNull()
  })

  it('makes an answered card leave the due list', () => {
    const fresh = card()
    expect(dueCards([fresh], NOW)).toHaveLength(1)
    const answered = schedule(fresh, 'again', NOW)
    expect(dueCards([answered], NOW)).toEqual([])
    expect(dueCards([answered], NOW + 5 * MINUTE)).toHaveLength(1)
  })
})

describe('formatWait and formatDue', () => {
  it.each([
    [30_000, '1 minute'],
    [5 * MINUTE, '5 minutes'],
    [59.6 * MINUTE, '1 hour'],
    [3 * 60 * MINUTE, '3 hours'],
    [23.6 * 60 * MINUTE, '1 day'],
    [DAY, '1 day'],
    [4 * DAY, '4 days'],
    [45 * DAY, '1 month'],
    [200 * DAY, '7 months'],
    [365 * DAY, '1 year'],
  ])('%d ms is "%s"', (ms, words) => {
    expect(formatWait(ms)).toBe(words)
  })

  it('says a card that is due is due now', () => {
    expect(formatDue(NOW, NOW)).toBe('Due now')
    expect(formatDue(NOW - DAY, NOW)).toBe('Due now')
    expect(formatDue(NOW + 3 * DAY, NOW)).toBe('in 3 days')
  })
})

describe('storage', () => {
  const learned = answer(card(), ['good', 'easy'])
  const other = createCard({ ...SOURCE, selectedCode: 'git push --force', language: 'shell', concept: 'Force push' }, NOW, 'card_2')

  it('saves the cards under one key with a schema version, and reads them back', () => {
    const storage = memoryStorage()
    expect(saveCards([learned, other], storage)).toBe(true)
    expect(JSON.parse(storage.data.get('lenscode:flashcards')!)).toEqual({
      schema: 1,
      cards: [learned, other],
    })
    expect(loadCards(storage)).toEqual([learned, other])
  })

  it('starts empty when nothing is saved', () => {
    expect(loadCards(memoryStorage())).toEqual([])
  })

  it.each([
    ['broken JSON', '{"schema":1,"cards":['],
    ['another schema', JSON.stringify({ schema: 2, cards: [card()] })],
    ['no schema', JSON.stringify({ cards: [card()] })],
    ['cards that are not a list', JSON.stringify({ schema: 1, cards: { a: card() } })],
    ['a bare list', JSON.stringify([card()])],
    ['a number', '42'],
    ['null', 'null'],
  ])('ignores %s', (_label, raw) => {
    expect(loadCards(memoryStorage({ [FLASHCARDS_KEY]: raw }))).toEqual([])
  })

  it('skips cards that are broken and keeps the rest', () => {
    const bad = [
      null,
      'card',
      42,
      [],
      { ...card(), id: '' },
      { ...card(), id: 7 },
      { ...card(), code: '   ' },
      { ...card(), code: undefined },
      { ...card(), concept: null },
      { ...card(), simpleExplanation: 3 },
      { ...card(), contextualExplanation: undefined },
      { ...card(), due: 'tomorrow' },
      { ...card(), due: null },
      { ...card(), interval: Number.NaN },
      { ...card(), ease: undefined },
      { ...card(), createdAt: Number.POSITIVE_INFINITY },
    ]
    expect(loadCards(stored({ schema: 1, cards: [...bad, other] }))).toEqual([other])
  })

  it('repairs what it safely can', () => {
    const [repaired] = loadCards(
      stored({
        schema: 1,
        cards: [{ ...card(), language: 'klingon', ease: 0.4, interval: -3, extra: 'dropped' }],
      }),
    )
    expect(repaired).toEqual({ ...card(), language: 'plaintext', ease: 1.3, interval: 0 })
    expect(loadCards(stored({ schema: 1, cards: [{ ...card(), interval: 2.6 }] }))[0].interval).toBe(3)
    expect(loadCards(stored({ schema: 1, cards: [{ ...card(), interval: 9_999 }] }))[0].interval).toBe(365)
  })

  it('keeps only the first of two cards with the same id or the same code and concept', () => {
    const sameId = { ...other, id: 'card_1' }
    const sameContent = { ...card(), id: 'card_3', code: 'const total = items.reduce((sum, x) => sum + x, 0);' }
    expect(loadCards(stored({ schema: 1, cards: [card(), sameId, sameContent, other] }))).toEqual([
      card(),
      other,
    ])
  })

  it('works without storage at all', () => {
    expect(loadCards(null)).toEqual([])
    expect(saveCards([card()], null)).toBe(false)
  })

  it('never throws when storage is blocked or full', () => {
    const blocked: CardStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadCards(blocked)).toEqual([])
    expect(saveCards([card()], blocked)).toBe(false)
  })
})

describe('browserStorage', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('is null where there is no localStorage, and the defaults still work', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage
    expect(browserStorage()).toBeNull()
    expect(loadCards()).toEqual([])
    expect(saveCards([card()])).toBe(false)
  })

  it('is null when the browser blocks it', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: access is denied')
      },
    })
    expect(browserStorage()).toBeNull()
    expect(loadCards()).toEqual([])
  })

  it('uses localStorage when there is one', () => {
    const storage = memoryStorage()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    expect(saveCards([card()])).toBe(true)
    expect(loadCards()).toEqual([card()])
  })
})

describe('toAnkiText', () => {
  it('writes the header lines Anki reads, then one line per card: front, a tab, back', () => {
    const text = toAnkiText([
      createCard(
        {
          selectedCode: 'git push --force',
          language: 'shell',
          concept: 'Force push',
          simpleExplanation: 'Replaces the history on the server.',
          contextualExplanation: 'Here it overwrites "main".',
        },
        NOW,
        'card_1',
      ),
    ])
    expect(text).toBe(
      '#separator:tab\n' +
        '#html:true\n' +
        "<pre style='display:inline-block;text-align:left'>git push --force</pre><br><small>Terminal command</small>" +
        '\t' +
        '<b>Force push</b><br><br>Replaces the history on the server.<br><br>' +
        '<i>In this code:</i> Here it overwrites &quot;main&quot;.\n',
    )
  })

  it('keeps every card on one line with exactly one tab, whatever the code holds', () => {
    const code = 'if (a < b && b > c) {\n\treturn "x"\r\n}'
    const text = toAnkiText([
      createCard({ ...SOURCE, selectedCode: code, concept: 'If\tstatement' }, NOW, 'card_1'),
      createCard({ ...SOURCE, selectedCode: 'x', concept: 'Variable' }, NOW, 'card_2'),
    ])
    const lines = text.trimEnd().split('\n')
    expect(lines).toHaveLength(4)
    for (const line of lines.slice(2)) expect(line.split('\t')).toHaveLength(2)
    expect(lines[2]).toContain(
      'if (a &lt; b &amp;&amp; b &gt; c) {<br>&#9;return &quot;x&quot;<br>}</pre>',
    )
    expect(lines[2]).toContain('<b>If&#9;statement</b>')
  })

  it('leaves out the language when it was not detected', () => {
    const text = toAnkiText([createCard({ ...SOURCE, language: 'plaintext' }, NOW, 'card_1')])
    expect(text).not.toContain('<small>')
  })

  it('writes just the header for no cards', () => {
    expect(toAnkiText([])).toBe('#separator:tab\n#html:true\n')
  })
})
