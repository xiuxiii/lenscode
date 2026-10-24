import { describe, expect, it } from 'vitest'
import { normalizeSelection, wholeRange } from './selection'

describe('normalizeSelection', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSelection('  const   x =\n  1  ')).toBe('const x = 1')
  })

  it('drops trailing semicolons and commas', () => {
    expect(normalizeSelection('foo();')).toBe('foo()')
    expect(normalizeSelection('a, b,,')).toBe('a, b')
    expect(normalizeSelection('x;  ')).toBe('x')
  })

  it('keeps semicolons and commas that are not at the end', () => {
    expect(normalizeSelection('for (;;) {}')).toBe('for (;;) {}')
  })

  it('ignores case', () => {
    expect(normalizeSelection('SELECT * FROM t')).toBe(normalizeSelection('select * from t'))
  })

  it('makes a re-highlight of the same code compare equal', () => {
    expect(normalizeSelection('await fetch(url);')).toBe(normalizeSelection(' await fetch(url) '))
  })

  it('returns an empty string for whitespace or punctuation-only input', () => {
    expect(normalizeSelection('  \n ')).toBe('')
    expect(normalizeSelection(' ; ')).toBe('')
  })
})

describe('wholeRange', () => {
  it('covers one line, ending just past its last character', () => {
    expect(wholeRange('git push --force')).toEqual({ startLine: 1, startColumn: 1, endLine: 1, endColumn: 17 })
  })

  it('covers every line of a longer text', () => {
    expect(wholeRange('for f in *; do\n  echo "$f"\ndone')).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 3,
      endColumn: 5,
    })
  })

  it('ends at column 1 of the last line after a trailing newline, as Monaco does', () => {
    expect(wholeRange('ls\n')).toEqual({ startLine: 1, startColumn: 1, endLine: 2, endColumn: 1 })
  })
})
