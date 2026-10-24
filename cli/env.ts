import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Env = Record<string, string | undefined>

/** A value: quoted (`\n` works inside double quotes) or bare, where `#` starts a comment. */
function readValue(raw: string): string {
  const quote = raw[0]
  if (quote === '"' || quote === "'" || quote === '`') {
    const end = raw.indexOf(quote, 1)
    if (end !== -1) {
      const inner = raw.slice(1, end)
      return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : inner
    }
  }
  const comment = raw.indexOf('#')
  return (comment === -1 ? raw : raw.slice(0, comment)).trim()
}

/**
 * The variables in a .env file: `KEY=value` lines, with `#` comments, an
 * optional `export` and optional quotes. These are the rules of the dotenv
 * package Vite uses for `npm run dev`, minus multi-line values and `${VAR}`.
 */
export function parseDotEnv(text: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(line)
    if (match) vars[match[1]] = readValue(match[2])
  }
  return vars
}

function readDotEnv(path: string): Record<string, string> {
  try {
    return parseDotEnv(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * The settings `lens` runs with. Like `npm run dev`: the shell's environment
 * wins, then `.env.local`, then `.env`, both from the LensCode `folder`, so
 * `lens` finds the key from any directory.
 */
export function loadEnv(folder: string, shellEnv: Env): Env {
  const set = Object.entries(shellEnv).filter(([, value]) => value !== undefined)
  return {
    ...readDotEnv(join(folder, '.env')),
    ...readDotEnv(join(folder, '.env.local')),
    ...Object.fromEntries(set),
  }
}
