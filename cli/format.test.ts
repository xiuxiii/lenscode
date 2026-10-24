import { describe, expect, it } from 'vitest'
import type { Explanation } from '../src/types/explanation'
import { colorEnabled, createStyle, formatExplanation, formatRisks } from './format'

const EXPLANATION: Explanation = {
  id: 'exp_1',
  selectedCode: 'git push --force',
  language: 'shell',
  concept: 'Force push',
  kind: 'statement',
  simpleExplanation: 'Uploads your commits and replaces what is on the server.',
  definition: 'Updates the remote ref even when it is not an ancestor.',
  contextualExplanation: 'Here "git push --force" overwrites the branch on GitHub.',
  whyItExists: 'Used after rewriting history.',
  relatedConcepts: [{ label: 'Remote', hint: 'the copy on a server' }, { label: 'Rebase' }],
}

const RISK = {
  match: 'git push --force',
  warning: 'Replaces the history on the server with yours.',
}

const plain = createStyle(false)
const color = createStyle(true)

describe('formatExplanation', () => {
  it('shows the title, plain answer, both sections and related concepts, in that order', () => {
    expect(formatExplanation(EXPLANATION, plain)).toBe(
      [
        'Force push',
        'Uploads your commits and replaces what is on the server.',
        '',
        'In this code',
        'Here "git push --force" overwrites the branch on GitHub.',
        '',
        'Why it’s here',
        'Used after rewriting history.',
        '',
        'Related concepts',
        '  • Remote — the copy on a server',
        '  • Rebase',
        '',
      ].join('\n'),
    )
  })

  it('leaves out the technical definition, as asked for the terminal', () => {
    expect(formatExplanation(EXPLANATION, plain)).not.toContain(EXPLANATION.definition)
  })

  it('leaves out Related concepts when there are none', () => {
    const text = formatExplanation({ ...EXPLANATION, relatedConcepts: [] }, plain)
    expect(text).not.toContain('Related')
    expect(text.endsWith('Used after rewriting history.\n')).toBe(true)
  })

  it('makes headings bold and hints dim with colour on', () => {
    const text = formatExplanation(EXPLANATION, color)
    expect(text).toContain('\x1b[1mForce push\x1b[22m')
    expect(text).toContain('\x1b[1mIn this code\x1b[22m')
    expect(text).toContain('\x1b[2m— the copy on a server\x1b[22m')
  })

  it('has no escape codes with colour off', () => {
    expect(formatExplanation(EXPLANATION, plain)).not.toContain('\x1b')
  })
})

describe('formatRisks', () => {
  it('is empty when nothing is risky', () => {
    expect(formatRisks([], plain)).toBe('')
  })

  it('lists each warning under a heading, then a blank line', () => {
    expect(formatRisks([RISK, { match: 'sudo', warning: 'Runs as administrator.' }], plain)).toBe(
      'Careful before you run this\n' +
        '  • git push --force — Replaces the history on the server with yours.\n' +
        '  • sudo — Runs as administrator.\n\n',
    )
  })

  it('shows the heading in bold yellow with colour on', () => {
    expect(formatRisks([RISK], color)).toContain('\x1b[1m\x1b[33mCareful before you run this\x1b[39m\x1b[22m')
  })
})

describe('colorEnabled', () => {
  it('is on only for a terminal without NO_COLOR', () => {
    expect(colorEnabled(true, {})).toBe(true)
    expect(colorEnabled(false, {})).toBe(false)
    expect(colorEnabled(true, { NO_COLOR: '1' })).toBe(false)
  })

  it('ignores an empty NO_COLOR, as no-color.org says', () => {
    expect(colorEnabled(true, { NO_COLOR: '' })).toBe(true)
  })
})
