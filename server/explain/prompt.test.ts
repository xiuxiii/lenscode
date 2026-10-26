import { describe, expect, it } from 'vitest'
import type { ExplanationRequest, FollowUpRequest } from '../../src/types/explanation.ts'
import { buildFollowUpMessages, buildMessages, excerptSource } from './prompt.ts'

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

describe('hiding secrets', () => {
  const KEY = 'sk-proj-abc123def456ghi789jkl'
  // Made up; the markers are assembled so no real-looking key sits in this file.
  const KEY_BODY = Array.from({ length: 28 }, (_, i) => `MIIEfake${i}abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN+/`)
  const keyBlock = ['-----BEGIN RSA PRIVATE KEY-----', ...KEY_BODY, '-----END RSA PRIVATE KEY-----']

  /** The numbered excerpt between <<<FILE and FILE>>>, as lines. */
  const excerptIn = (user: string) =>
    user.slice(user.indexOf('<<<FILE\n') + 8, user.indexOf('\nFILE>>>')).split('\n')

  it('hides a key in the selection and in the file', () => {
    const fullSource = `import OpenAI from 'openai'\nconst API_KEY = "${KEY}"\nconst client = new OpenAI({ apiKey: API_KEY })`
    const messages = buildMessages(
      request({
        selectedCode: `const API_KEY = "${KEY}"`,
        surroundingContext: { fullSource, range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 46 } },
      }),
    )
    const sent = JSON.stringify(messages)
    expect(sent).not.toContain(KEY)
    expect(sent).not.toContain('abc123')
    const user = messages[1].content
    expect(user).toContain('<<<SELECTION\nconst API_KEY = "[hidden secret]"\nSELECTION>>>')
    expect(user).toContain('> 2 | const API_KEY = "[hidden secret]"')
    expect(user).toContain('  3 | const client = new OpenAI({ apiKey: API_KEY })')
  })

  it('keeps every line number and ">" marker right around a hidden key block', () => {
    const lines = [
      'const fs = require("fs")',
      ...keyBlock,
      ...Array.from({ length: 20 }, (_, i) => `step${i}()`),
      'const password = "hunter2hunter2"',
      'login(password)',
    ]
    const fullSource = lines.join('\n')
    const range = { startLine: 52, startColumn: 1, endLine: 53, endColumn: 16 }
    const user = buildMessages(
      request({ selectedCode: lines.slice(51, 53).join('\n'), surroundingContext: { fullSource, range } }),
    )[1].content

    const sent = excerptIn(user)
    const plain = excerptSource(fullSource, range).split('\n')
    expect(sent).toHaveLength(plain.length)
    // Same prefix ("> 52 |") on every line; only secret values differ.
    sent.forEach((line, i) => expect(line.slice(0, line.indexOf('|'))).toBe(plain[i].slice(0, plain[i].indexOf('|'))))
    expect(sent[0]).toBe('  12 | ') // a key line, emptied
    expect(sent.find((l) => l.includes('-----END'))).toBe('  31 | -----END RSA PRIVATE KEY-----')
    expect(sent.at(-2)).toBe('> 52 | const password = "[hidden secret]"')
    expect(sent.at(-1)).toBe('> 53 | login(password)')
    expect(user).not.toContain('MIIEfake')
    expect(user).not.toContain('hunter2')
  })

  it('hides a key whose BEGIN line is above the excerpt', () => {
    const fullSource = [...keyBlock, ...Array.from({ length: 60 }, (_, i) => `line ${i}`)].join('\n')
    // Lines 1–30 are the key; the excerpt starts at line 25, inside it.
    const range = { startLine: 65, startColumn: 1, endLine: 65, endColumn: 5 }
    const user = buildMessages(request({ selectedCode: 'line', surroundingContext: { fullSource, range } }))[1].content
    expect(excerptIn(user).slice(0, 6)).toEqual([
      '  25 | ',
      '  26 | ',
      '  27 | ',
      '  28 | ',
      '  29 | ',
      '  30 | -----END RSA PRIVATE KEY-----',
    ])
    expect(user).not.toContain('MIIEfake')
  })

  it('hides a selection that is only part of a key', () => {
    // A double-click selects one word of the key, which looks harmless alone.
    const fullSource = `OPENAI_API_KEY=${KEY}\nDEBUG=true`
    const user = buildMessages(
      request({
        selectedCode: 'abc123def456ghi789jkl',
        surroundingContext: { fullSource, range: { startLine: 1, startColumn: 25, endLine: 1, endColumn: 46 } },
      }),
    )[1].content
    expect(user).toContain('<<<SELECTION\n[hidden secret]\nSELECTION>>>')
    expect(user).toContain('> 1 | OPENAI_API_KEY=[hidden secret]')
    expect(user).not.toContain('abc123')
  })

  it('keeps a selection that is not part of a secret', () => {
    const fullSource = `OPENAI_API_KEY=${KEY}\nDEBUG=true`
    const user = buildMessages(
      request({
        selectedCode: 'OPENAI_API_KEY',
        surroundingContext: { fullSource, range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 15 } },
      }),
    )[1].content
    expect(user).toContain('<<<SELECTION\nOPENAI_API_KEY\nSELECTION>>>')
  })

  it('tells the model what "[hidden secret]" means in both prompts', () => {
    const followUp: FollowUpRequest = {
      request: request(),
      explanation: {
        concept: 'Await keyword',
        simpleExplanation: 'It waits.',
        definition: 'Pauses until a promise settles.',
        contextualExplanation: 'Waits for fetch.',
        whyItExists: 'So r is the response.',
      },
      previous: [],
      question: 'Why?',
    }
    for (const system of [buildMessages(request())[0].content, buildFollowUpMessages(followUp)[0].content]) {
      expect(system).toContain('"[hidden secret]" is a value LensCode removed for privacy')
      expect(system).toContain('Never call it a bug')
    }
  })

  it('hides keys in a follow-up question, the earlier turns and the explanation', () => {
    const messages = buildFollowUpMessages({
      request: request({ selectedCode: `token = "${KEY}"` }),
      explanation: {
        concept: 'Assignment',
        simpleExplanation: `Stores ${KEY} in a variable.`,
        definition: 'Binds a name to a value.',
        contextualExplanation: 'password = "hunter2hunter2" is set here.',
        whyItExists: 'To call the API.',
      },
      previous: [{ question: `Is ${KEY} safe to share?`, answer: `No, keep ghp_abcdefghij0123456789 private.` }],
      question: `What about AKIAZZZZ1234ZZZZ5678?`,
    })
    const sent = JSON.stringify(messages)
    for (const secret of [KEY, 'hunter2', 'ghp_abcdefghij0123456789', 'AKIAZZZZ1234ZZZZ5678']) {
      expect(sent).not.toContain(secret)
    }
    expect(messages.at(-1)?.content).toContain('Their question: What about [hidden secret]?')
    expect(messages[2].content).toBe(JSON.stringify({ answer: 'No, keep [hidden secret] private.' }))
  })
})
