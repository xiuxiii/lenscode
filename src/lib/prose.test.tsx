import { isValidElement, type ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderProse } from './prose'

/** Each rendered part as [tag, text]. */
function parts(text: string): [string, string][] {
  return renderProse(text).map((node) => {
    if (!isValidElement(node)) throw new Error('expected an element')
    const el = node as ReactElement<{ children: string }>
    return [el.type as string, el.props.children]
  })
}

describe('renderProse', () => {
  it('turns "quoted" names into inline code', () => {
    expect(parts('The "response" variable holds it.')).toEqual([
      ['span', 'The '],
      ['code', 'response'],
      ['span', ' variable holds it.'],
    ])
  })

  it('handles several quoted names', () => {
    const out = parts('"a" plus "b"')
    expect(out.filter(([tag]) => tag === 'code').map(([, text]) => text)).toEqual(['a', 'b'])
  })

  it('leaves text without quotes as one span', () => {
    expect(parts('Plain words.')).toEqual([['span', 'Plain words.']])
  })

  it('does not turn empty quotes into code', () => {
    expect(parts('An empty string is "".').some(([tag]) => tag === 'code')).toBe(false)
  })

  it('does not turn a lone quote into code', () => {
    expect(parts('A 12" ruler.')).toEqual([['span', 'A 12" ruler.']])
  })

  it('gives every part a key', () => {
    for (const node of renderProse('a "b" c')) {
      expect(isValidElement(node) && node.key).not.toBeNull()
    }
  })
})
