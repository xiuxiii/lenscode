import { describe, expect, it } from 'vitest'
import { lensCommand, setupMacText, setupZshText, shellQuote } from './setup'

const PATHS = { node: '/opt/homebrew/bin/node', script: '/Users/me/lenscode/dist-cli/lens.mjs' }

describe('shellQuote', () => {
  it('leaves ordinary paths alone', () => {
    expect(shellQuote('/usr/local/bin/node')).toBe('/usr/local/bin/node')
    expect(shellQuote('/Users/me/.nvm/versions/node/v22.11.0/bin/node')).toBe(
      '/Users/me/.nvm/versions/node/v22.11.0/bin/node',
    )
  })

  it('single-quotes anything with spaces or shell characters', () => {
    expect(shellQuote('/Users/me/My Code/lens.mjs')).toBe("'/Users/me/My Code/lens.mjs'")
    expect(shellQuote('/tmp/$(rm -rf ~)')).toBe("'/tmp/$(rm -rf ~)'")
    expect(shellQuote('')).toBe("''")
  })

  it('escapes single quotes inside', () => {
    expect(shellQuote("/Users/o'neil/lens.mjs")).toBe(`'/Users/o'\\''neil/lens.mjs'`)
  })
})

describe('lensCommand', () => {
  it('names Node and the CLI by their full paths', () => {
    expect(lensCommand(PATHS)).toBe('/opt/homebrew/bin/node /Users/me/lenscode/dist-cli/lens.mjs')
    expect(lensCommand({ node: '/usr/bin/node', script: '/Users/me/Lens Code/dist-cli/lens.mjs' })).toBe(
      "/usr/bin/node '/Users/me/Lens Code/dist-cli/lens.mjs'",
    )
  })
})

describe('setupMacText', () => {
  const text = setupMacText(PATHS)

  it('gives the exact command to paste, reading the selection from stdin', () => {
    expect(text).toContain('   /opt/homebrew/bin/node /Users/me/lenscode/dist-cli/lens.mjs --popup\n')
    expect(text).toContain('Pass Input to "to stdin"')
    expect(text).toContain('--open')
  })

  it('covers the Quick Action, the Services menu, scripts and the keyboard shortcut', () => {
    expect(text).toContain('Use as Quick Action')
    expect(text).toContain('Services Menu')
    expect(text).toContain('receive only "Text" input from\n   "Quick Actions"')
    expect(text).toContain('Allow Running Scripts')
    expect(text).toContain('System Settings > Keyboard > Keyboard\n   Shortcuts… > Services')
  })

  it('numbers its steps in order', () => {
    const steps = [...text.matchAll(/^(\d)\. /gm)].map((m) => Number(m[1]))
    expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('setupZshText', () => {
  const text = setupZshText(PATHS)

  it('pipes the line being typed to lens instead of running it', () => {
    expect(text).toContain(
      'print -rn -- "$BUFFER" | /opt/homebrew/bin/node /Users/me/lenscode/dist-cli/lens.mjs\n',
    )
    expect(text).not.toMatch(/accept-line|eval/)
  })

  it('binds Ctrl+X Ctrl+L to the widget', () => {
    expect(text).toContain('zle -N lens-explain-line\n')
    expect(text).toContain("bindkey '^X^L' lens-explain-line\n")
  })

  it('is valid to append to ~/.zshrc: everything that is not code is a comment', () => {
    const code = text.split('\n').filter((line) => line && !line.startsWith('#'))
    expect(code[0]).toBe('lens-explain-line() {')
    expect(code.at(-1)).toBe("bindkey '^X^L' lens-explain-line")
  })
})
