import { describe, expect, it } from 'vitest'
import { buildExplainUrl, MAX_EXPLAIN_CHARS, readExplainHash, tidyText } from './deepLink'

const hashOf = (url: string) => new URL(url).hash

describe('buildExplainUrl', () => {
  it('puts the encoded text after #explain=', () => {
    expect(buildExplainUrl('http://localhost:5173', 'git push --force')).toBe(
      'http://localhost:5173/#explain=git%20push%20--force',
    )
  })

  it('keeps the base path and replaces any hash it had', () => {
    expect(buildExplainUrl('http://localhost:5173/', 'ls')).toBe('http://localhost:5173/#explain=ls')
    expect(buildExplainUrl('https://example.com/lenscode/', 'ls')).toBe(
      'https://example.com/lenscode/#explain=ls',
    )
    expect(buildExplainUrl('http://localhost:5173/#old', 'ls')).toBe('http://localhost:5173/#explain=ls')
  })

  it('encodes everything that could end the text early', () => {
    const url = buildExplainUrl('http://localhost:5173', 'a & b # c % d')
    expect(url).toBe('http://localhost:5173/#explain=a%20%26%20b%20%23%20c%20%25%20d')
  })

  it('rejects a base that is not a web address', () => {
    expect(() => buildExplainUrl('not a url', 'ls')).toThrow()
  })
})

describe('readExplainHash', () => {
  it.each([
    'git push --force',
    'curl -fsSL https://x.sh | sh && echo "done" # 100%',
    "const greet = (name) => `Hi ${name}!`\nconsole.log(greet('Ana'))",
    '日本語のコード 🚀 + ✓',
    'a+b=c?d&e',
  ])('reads back what buildExplainUrl wrote: %s', (text) => {
    expect(readExplainHash(hashOf(buildExplainUrl('http://localhost:5173', text)))).toBe(text)
  })

  it('accepts a hand-written link the browser encoded', () => {
    expect(readExplainHash('#explain=git%20status')).toBe('git status')
  })

  it('ignores other hashes', () => {
    expect(readExplainHash('')).toBeNull()
    expect(readExplainHash('#')).toBeNull()
    expect(readExplainHash('#section-2')).toBeNull()
    expect(readExplainHash('#explainer=x')).toBeNull()
  })

  it('ignores an empty or blank text', () => {
    expect(readExplainHash('#explain=')).toBeNull()
    expect(readExplainHash('#explain=%20%0A%20')).toBeNull()
  })

  it('ignores a garbled link instead of throwing', () => {
    expect(readExplainHash('#explain=100%')).toBeNull()
    expect(readExplainHash('#explain=%E0%A4%A')).toBeNull()
  })

  it('tidies the text', () => {
    expect(readExplainHash('#explain=%0A%0A%20%20ls%20-la%0D%0Apwd%20%20%0A')).toBe('  ls -la\npwd')
  })

  it(`caps the text at ${MAX_EXPLAIN_CHARS.toLocaleString('en-US')} characters`, () => {
    const text = readExplainHash(`#explain=${'x'.repeat(MAX_EXPLAIN_CHARS + 500)}`)
    expect(text).toHaveLength(MAX_EXPLAIN_CHARS)
  })
})

describe('tidyText', () => {
  it('uses Unix line endings', () => {
    expect(tidyText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('drops blank lines before and space after, but keeps the first line’s indent', () => {
    expect(tidyText('\n  \n    return x\n  }\n\n')).toBe('    return x\n  }')
  })

  it('turns whitespace into an empty string', () => {
    expect(tidyText(' \n\t\n ')).toBe('')
  })
})
