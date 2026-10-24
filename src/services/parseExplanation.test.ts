import { describe, expect, it } from 'vitest'
import { ExplanationError, type ExplanationRequest } from '../types/explanation'
import { parseExplanationResponse } from './parseExplanation'

const REQUEST: ExplanationRequest = {
  selectedCode: '  await  \n',
  language: 'javascript',
  surroundingContext: { fullSource: 'const r = await fetch(url)', range: null },
}

/** A complete answer in the canonical vocabulary the model is asked for. */
const CANONICAL = {
  title: 'Await keyword',
  kind: 'keyword',
  whatIsIt: 'It waits for "fetch" to finish.',
  technicalDefinition: 'Pauses an async function until a promise settles.',
  inThisCode: 'Waits for the users to load.',
  whyItsHere: 'So "response" holds the real reply.',
  relatedConcepts: [
    { name: 'Promise', explanation: 'a value that arrives later' },
    { name: 'async function' },
  ],
}

function expectInvalid(body: unknown) {
  try {
    parseExplanationResponse(body, REQUEST)
  } catch (err) {
    expect(err).toBeInstanceOf(ExplanationError)
    expect((err as ExplanationError).code).toBe('invalid_response')
    return
  }
  throw new Error('expected parseExplanationResponse to throw')
}

describe('parseExplanationResponse', () => {
  it('maps the canonical field names onto the internal ones', () => {
    const e = parseExplanationResponse(CANONICAL, REQUEST)
    expect(e).toMatchObject({
      concept: 'Await keyword',
      kind: 'keyword',
      simpleExplanation: 'It waits for "fetch" to finish.',
      definition: 'Pauses an async function until a promise settles.',
      contextualExplanation: 'Waits for the users to load.',
      whyItExists: 'So "response" holds the real reply.',
      relatedConcepts: [
        { label: 'Promise', hint: 'a value that arrives later' },
        { label: 'async function' },
      ],
    })
  })

  it('accepts the internal field names too', () => {
    const e = parseExplanationResponse(
      {
        concept: 'Await keyword',
        kind: 'keyword',
        simpleExplanation: 'a',
        definition: 'b',
        contextualExplanation: 'c',
        whyItExists: 'd',
        relatedConcepts: [{ label: 'Promise', hint: 'later' }],
      },
      REQUEST,
    )
    expect(e.simpleExplanation).toBe('a')
    expect(e.relatedConcepts).toEqual([{ label: 'Promise', hint: 'later' }])
  })

  it('echoes the trimmed selection and the request language', () => {
    const e = parseExplanationResponse(CANONICAL, REQUEST)
    expect(e.selectedCode).toBe('await')
    expect(e.language).toBe('javascript')
  })

  it('generates an id when the answer has none, and keeps one that it has', () => {
    const a = parseExplanationResponse(CANONICAL, REQUEST)
    const b = parseExplanationResponse(CANONICAL, REQUEST)
    expect(a.id).toMatch(/^exp_/)
    expect(a.id).not.toBe(b.id)
    expect(parseExplanationResponse({ ...CANONICAL, id: 'given' }, REQUEST).id).toBe('given')
  })

  it('falls back to "expression" for an unknown kind', () => {
    expect(parseExplanationResponse({ ...CANONICAL, kind: 'banana' }, REQUEST).kind).toBe(
      'expression',
    )
    const { kind: _kind, ...noKind } = CANONICAL
    expect(parseExplanationResponse(noKind, REQUEST).kind).toBe('expression')
  })

  it('falls back to a generic title', () => {
    const { title: _title, ...noTitle } = CANONICAL
    expect(parseExplanationResponse(noTitle, REQUEST).concept).toBe('Explanation')
  })

  it('accepts related concepts as plain strings and drops unusable ones', () => {
    const e = parseExplanationResponse(
      { ...CANONICAL, relatedConcepts: ['Promise', '', '  ', 42, null, { explanation: 'no name' }, { name: 'Event loop' }] },
      REQUEST,
    )
    expect(e.relatedConcepts).toEqual([{ label: 'Promise' }, { label: 'Event loop' }])
  })

  it('treats missing related concepts as none', () => {
    const { relatedConcepts: _r, ...none } = CANONICAL
    expect(parseExplanationResponse(none, REQUEST).relatedConcepts).toEqual([])
    expect(
      parseExplanationResponse({ ...CANONICAL, relatedConcepts: 'Promise' }, REQUEST).relatedConcepts,
    ).toEqual([])
  })

  it.each(['whatIsIt', 'technicalDefinition', 'inThisCode', 'whyItsHere'] as const)(
    'rejects an answer missing %s',
    (field) => {
      const { [field]: _omitted, ...rest } = CANONICAL
      expectInvalid(rest)
    },
  )

  it('rejects blank sections as missing', () => {
    expectInvalid({ ...CANONICAL, whatIsIt: '   ' })
  })

  it.each([null, undefined, 'text', 42, []])('rejects a non-object body: %j', (body) => {
    expectInvalid(body)
  })
})
