/**
 * Links that open LensCode with some text explained, such as
 *
 *   http://localhost:5173/#explain=git%20push%20--force
 *
 * `lens --open` builds them (see `cli/`); `useDeepLink` reads them in the
 * app. The text travels in the part after `#`, which browsers never send to
 * a server.
 */

/** The most one explanation can take: the API's limit on a selection. */
export const MAX_EXPLAIN_CHARS = 8_000

const PREFIX = '#explain='

/** Unix line endings, no blank lines before the text and no spaces after it. */
export function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\n/, '')
    .trimEnd()
}

/** The link that opens the LensCode at `base` and explains `text`. */
export function buildExplainUrl(base: string, text: string): string {
  const url = new URL(base)
  url.hash = ''
  return `${url.href}${PREFIX}${encodeURIComponent(text)}`
}

/**
 * The text a `#explain=…` hash asks to explain, tidied and cut to
 * `MAX_EXPLAIN_CHARS`. `null` when the hash asks for nothing (or is garbled).
 */
export function readExplainHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null
  let text: string
  try {
    text = decodeURIComponent(hash.slice(PREFIX.length))
  } catch {
    return null
  }
  text = tidyText(text).slice(0, MAX_EXPLAIN_CHARS)
  return text.trim() ? text : null
}
