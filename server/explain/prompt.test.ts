import { describe, expect, it } from 'vitest'
import type { ExplanationRequest } from '../../src/types/explanation.ts'
import { buildMessages, excerptSource } from './prompt.ts'

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')

const request = (overrides: Partial<ExplanationRequest> = {}): ExplanationRequest => ({
  selectedCode: 'await',
  language: 'javascript',
  fileName: 'fetchUsers.js',
  surroundingContext: {
    fullSource: 'async function f() {\n  const r = await fetch(url);\n}',
    range: { startLine: 2, startColumn: 13, endLine: 2, endColumn: 18 },
  },
  ...overrides,
})

describe('excerptSource', () => {
  it('numbers lines and marks the selected ones', () => {
    const out = excerptSource('a\nb\nc', { startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 })
    expect(out.split('\n')).toEqual(['  1 | a', '> 2 | b', '  3 | c'])
  })

  it('shows a window of 40 lines either side of the selection', () => {
    const out = excerptSource(lines(200), { startLine: 100, startColumn: 1, endLine: 101, endColumn: 1 })
    const numbers = out.split('\n').map((l) => Number(l.slice(2).split('|')[0]))
    expect(numbers[0]).toBe(60)
    expect(numbers.at(-1)).toBe(141)
    expect(out).toContain('> 100 | line 100')
    expect(out).toContain('> 101 | line 101')
    expect(out).toContain('   99 | line 99')
  })

  it('clamps the window at the start and end of the file', () => {
    const out = excerptSource(lines(10), { startLine: 1, startColumn: 1, endLine: 10, endColumn: 1 })
    expect(out.split('\n')).toHaveLength(10)
  })

  it('pads line numbers to the widest one', () => {
    const out = excerptSource(lines(12), { startLine: 12, startColumn: 1, endLine: 12, endColumn: 1 })
    expect(out).toContain('   1 | line 1')
    expect(out).toContain('> 12 | line 12')
  })

  it('sends the top of the file when there is no range', () => {
    const out = excerptSource(lines(200), null)
    expect(out).toContain('  1 | line 1')
    expect(out).toContain('120 | line 120')
    expect(out).not.toContain('line 121')
    expect(out).toMatch(/rest of file omitted\)$/)
    expect(out).not.toContain('>')
  })

  it('does not mention omitted lines for a short file', () => {
    expect(excerptSource('a\nb', null)).not.toContain('omitted')
  })

  it('caps very long excerpts', () => {
    const long = Array.from({ length: 100 }, () => 'x'.repeat(500)).join('\n')
    const out = excerptSource(long, { startLine: 50, startColumn: 1, endLine: 50, endColumn: 1 })
    expect(out.length).toBeLessThan(12_100)
    expect(out).toMatch(/… \(truncated\)$/)
  })
})

describe('buildMessages', () => {
  it('sends a system prompt and one user message', () => {
    const messages = buildMessages(request())
    expect(messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(messages[0].content).toContain('Respond with a single JSON object')
  })

  it('includes the file, language, selection and surrounding code', () => {
    const user = buildMessages(request())[1].content
    expect(user).toContain('File: fetchUsers.js')
    expect(user).toContain('Language (auto-detected): JavaScript')
    expect(user).toContain('The user highlighted this, on line 2:')
    expect(user).toContain('<<<SELECTION\nawait\nSELECTION>>>')
    expect(user).toContain('> 2 |   const r = await fetch(url);')
    expect(user.trim().endsWith('Explain the selection as JSON.')).toBe(true)
  })

  it('names a multi-line range', () => {
    const user = buildMessages(
      request({
        surroundingContext: {
          fullSource: 'a\nb\nc',
          range: { startLine: 1, startColumn: 1, endLine: 3, endColumn: 2 },
        },
      }),
    )[1].content
    expect(user).toContain('on lines 1–3:')
  })

  it('asks the model to work out an undetected language', () => {
    const user = buildMessages(request({ language: 'plaintext' }))[1].content
    expect(user).toContain('Language: not detected — work it out from the code')
  })

  it('frames a selection without a range as a possible concept name', () => {
    const user = buildMessages(
      request({ selectedCode: 'Promise', surroundingContext: { fullSource: 'x', range: null } }),
    )[1].content
    expect(user).toContain('it may be a concept name')
    expect(user).toContain('The file it relates to:')
  })

  it('leaves out the file block when there is no source', () => {
    const user = buildMessages(
      request({ surroundingContext: { fullSource: '  ', range: null } }),
    )[1].content
    expect(user).not.toContain('<<<FILE')
  })

  it('labels a file without a name as untitled', () => {
    const user = buildMessages(request({ fileName: undefined }))[1].content
    expect(user).toContain('File: (untitled)')
  })

  it('trims the selection', () => {
    const user = buildMessages(request({ selectedCode: '\n  await  \n' }))[1].content
    expect(user).toContain('<<<SELECTION\nawait\nSELECTION>>>')
  })
})
