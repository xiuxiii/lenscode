/**
 * The `--popup` dialog on macOS: an AppleScript `display dialog` run with
 * `osascript`. The message becomes a string literal inside the script, so it
 * is escaped to stay text: nothing in it can end the string and run as code.
 */

export const OPEN_BUTTON = 'Open in LensCode'

/** `text` as an AppleScript string literal, quotes included. */
export function appleScriptString(text: string): string {
  const escaped = text
    .replace(/\r\n?/g, '\n')
    // Control characters other than newline and tab have no place in a dialog.
    .replace(/(?![\n\t])\p{Cc}/gu, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

/** A dialog showing `message`, with "Open in LensCode" and "OK" buttons. */
export function dialogScript(message: string, { caution }: { caution: boolean }): string {
  return [
    `display dialog ${appleScriptString(message)}`,
    'with title "LensCode"',
    `buttons {${appleScriptString(OPEN_BUTTON)}, "OK"} default button "OK"`,
    `with icon ${caution ? 'caution' : 'note'}`,
  ].join(' ')
}

/** Whether osascript's output says the "Open in LensCode" button was clicked. */
export function choseOpen(osascriptOutput: string | null): boolean {
  return osascriptOutput?.includes(`button returned:${OPEN_BUTTON}`) ?? false
}
