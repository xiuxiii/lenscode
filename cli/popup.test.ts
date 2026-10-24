import { describe, expect, it } from 'vitest'
import { appleScriptString, choseOpen, dialogScript, OPEN_BUTTON } from './popup'

describe('appleScriptString', () => {
  it('wraps plain text in double quotes', () => {
    expect(appleScriptString('git status')).toBe('"git status"')
  })

  it('escapes double quotes and backslashes', () => {
    expect(appleScriptString('say "hi"')).toBe('"say \\"hi\\""')
    expect(appleScriptString('C:\\temp')).toBe('"C:\\\\temp"')
    // The backslash is escaped first, so an escaped quote stays escaped.
    expect(appleScriptString('\\"')).toBe('"\\\\\\""')
  })

  it('writes line breaks and tabs as escapes', () => {
    expect(appleScriptString('one\ntwo\r\nthree\rfour\tfive')).toBe('"one\\ntwo\\nthree\\nfour\\tfive"')
  })

  it('drops other control characters', () => {
    expect(appleScriptString('a\u0000b\u0007c\u001bd\u007fe')).toBe('"abcde"')
  })

  it('keeps Unicode, including AppleScript’s « » and curly quotes', () => {
    expect(appleScriptString('« “it’s” » ✓ 日本')).toBe('"« “it’s” » ✓ 日本"')
  })

  it('cannot be broken out of: an attempt to end the string stays text', () => {
    const attack = '" & (do shell script "touch /tmp/pwned") & "'
    const literal = appleScriptString(attack)
    // Every quote inside is escaped, so the only unescaped quotes are the outer two.
    const unescaped = literal.slice(1, -1).match(/(?<!\\)(\\\\)*"/g)
    expect(unescaped).toBeNull()
    expect(literal).toBe('"\\" & (do shell script \\"touch /tmp/pwned\\") & \\""')
  })
})

describe('dialogScript', () => {
  it('shows the message with the two buttons, OK by default', () => {
    expect(dialogScript('Hello "you"', { caution: false })).toBe(
      'display dialog "Hello \\"you\\"" with title "LensCode" ' +
        'buttons {"Open in LensCode", "OK"} default button "OK" with icon note',
    )
  })

  it('uses the caution icon for risky commands', () => {
    expect(dialogScript('x', { caution: true })).toMatch(/with icon caution$/)
  })
})

describe('choseOpen', () => {
  it('reads which button osascript says was clicked', () => {
    expect(choseOpen(`button returned:${OPEN_BUTTON}\n`)).toBe(true)
    expect(choseOpen('button returned:OK\n')).toBe(false)
    expect(choseOpen(null)).toBe(false)
  })
})
