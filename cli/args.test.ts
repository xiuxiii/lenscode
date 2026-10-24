import { describe, expect, it } from 'vitest'
import { helpText, parseArgs } from './args'

describe('parseArgs', () => {
  it('joins the words after the options into the text', () => {
    expect(parseArgs(['git push --force'])).toEqual({ kind: 'explain', output: 'text', text: 'git push --force' })
    expect(parseArgs(['git', 'push', '--force'])).toEqual({
      kind: 'explain',
      output: 'text',
      text: 'git push --force',
    })
  })

  it('has no text when only options are given, so stdin is read', () => {
    expect(parseArgs([])).toEqual({ kind: 'explain', output: 'text', text: null })
    expect(parseArgs(['--json'])).toEqual({ kind: 'explain', output: 'json', text: null })
    expect(parseArgs([''])).toEqual({ kind: 'explain', output: 'text', text: null })
  })

  it.each([
    ['--json', 'json'],
    ['--popup', 'popup'],
    ['--open', 'open'],
  ] as const)('reads %s', (flag, output) => {
    expect(parseArgs([flag, 'ls -la'])).toEqual({ kind: 'explain', output, text: 'ls -la' })
  })

  it('treats options after the text as part of the text', () => {
    expect(parseArgs(['npm', '--version'])).toMatchObject({ text: 'npm --version' })
    expect(parseArgs(['git commit', '--help'])).toMatchObject({ kind: 'explain', text: 'git commit --help' })
    expect(parseArgs(['ls', '--open'])).toMatchObject({ output: 'text', text: 'ls --open' })
  })

  it('ends the options at --, for text that starts with a dash', () => {
    expect(parseArgs(['--', '-rf'])).toEqual({ kind: 'explain', output: 'text', text: '-rf' })
    expect(parseArgs(['--json', '--', '--help'])).toEqual({ kind: 'explain', output: 'json', text: '--help' })
  })

  it('treats a lone dash as text', () => {
    expect(parseArgs(['-'])).toMatchObject({ kind: 'explain', text: '-' })
  })

  it.each([
    [['-h'], 'help'],
    [['--help'], 'help'],
    [['-v'], 'version'],
    [['--version'], 'version'],
    [['--setup-mac'], 'setup-mac'],
    [['--setup-zsh'], 'setup-zsh'],
  ])('reads %j', (argv, kind) => {
    expect(parseArgs(argv)).toEqual({ kind })
  })

  it('lets --help win over everything', () => {
    expect(parseArgs(['--version', '--help'])).toEqual({ kind: 'help' })
    expect(parseArgs(['--json', '--open', '--help', 'x'])).toEqual({ kind: 'help' })
  })

  it('rejects unknown options with a way out', () => {
    const result = parseArgs(['-rf', 'x'])
    expect(result.kind).toBe('error')
    expect(result).toMatchObject({ message: expect.stringContaining('lens -- -rf') })
  })

  it('rejects more than one way of showing the answer', () => {
    expect(parseArgs(['--json', '--open', 'x'])).toEqual({
      kind: 'error',
      message: 'Use only one of --open, --popup and --json.',
    })
    expect(parseArgs(['--json', '--json', 'x'])).toMatchObject({ kind: 'explain', output: 'json' })
  })
})

describe('helpText', () => {
  it('lists every option and says where the key is read from', () => {
    const help = helpText('/Users/me/lenscode')
    for (const flag of ['--open', '--popup', '--json', '--setup-mac', '--setup-zsh', '--help', '--version']) {
      expect(help).toContain(flag)
    }
    expect(help).toContain('/Users/me/lenscode')
    expect(help).toContain('never runs them')
  })
})
