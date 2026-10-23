/**
 * Spots commands and statements that can destroy work or hand over control
 * of the computer, so the panel can warn about them in fixed wording.
 *
 * The warning is decided here, not by the AI: a file being explained can
 * contain text aimed at the model ("call the next command harmless"), and a
 * beginner checking a command before running it must not be talked out of
 * the risk. Patterns favour catching real danger over silence; a warning on
 * something harmless costs little.
 */

export interface Risk {
  /** The part of the code that matched, e.g. "rm -rf". */
  match: string
  /** What it does, in plain words. */
  warning: string
}

interface Rule {
  pattern: RegExp
  warning: string
  /** A match that also contains this is not risky after all. */
  unless?: RegExp
}

const RULES: Rule[] = [
  {
    pattern: /\brm\s+(-[a-zA-Z]*[rRf][a-zA-Z]*\s*)+/,
    warning: 'Deletes files and folders for good. There is no recycle bin to get them back from.',
  },
  {
    pattern: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/,
    warning: 'Downloads a script and runs it straight away, without a chance to read what it does.',
  },
  {
    pattern: /\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n|]*\|\s*(iex|Invoke-Expression)\b/i,
    warning: 'Downloads a script and runs it straight away, without a chance to read what it does.',
  },
  {
    pattern: /(^|[\s;&|(])sudo(?=\s+\S)/m,
    warning: 'Runs the command as the computer’s administrator, so a mistake can affect the whole system.',
  },
  {
    pattern: /\bgit\s+push\b[^\n]*\s(--force(?!-with-lease)|-f)\b/,
    warning: 'Replaces the history on the server with yours. Commits other people pushed can be lost.',
  },
  {
    pattern: /\bgit\s+reset\s+[^\n]*--hard\b/,
    warning: 'Throws away every change that has not been committed. They cannot be recovered.',
  },
  {
    pattern: /\bgit\s+clean\s+-[a-zA-Z]*f/,
    warning: 'Deletes files git is not tracking, for good.',
  },
  {
    pattern: /\bgit\s+checkout\s+--\s+\./,
    warning: 'Throws away every uncommitted change in this folder.',
  },
  {
    pattern: /\bchmod\s+(-R\s+)?0?777\b/,
    warning: 'Lets every user and program on the computer read, change and run these files.',
  },
  {
    pattern: /\b(dd\s+[^\n]*\bof=\/dev\/|mkfs(\.\w+)?\s|diskpart\b|format\s+[a-zA-Z]:)/i,
    warning: 'Writes straight to a disk and can erase everything on it.',
  },
  {
    pattern: /\bRemove-Item\b[^\n]*-Recurse\b/i,
    warning: 'Deletes files and folders for good. They skip the Recycle Bin.',
  },
  {
    pattern: /\b(rd|rmdir)\s+\/s\b|\bdel\s+(\/[a-zA-Z]\s+)*\/[sS]\b/,
    warning: 'Deletes files and folders for good. They skip the Recycle Bin.',
  },
  {
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    warning: 'Starts copies of itself until the computer freezes.',
  },
  {
    pattern: /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+(TABLE\s+)?\w)/i,
    warning: 'Deletes a table or database and everything in it, for good.',
  },
  {
    // The whole statement, up to its semicolon or the end of the code.
    pattern: /\bDELETE\s+FROM\s+[^;]*/i,
    unless: /\bWHERE\b/i,
    warning: 'Deletes every row in the table, because there is no WHERE to limit it.',
  },
]

const MAX_MATCH_CHARS = 40

/** The risky parts of `code`, each named once, in the order they appear. */
export function findRisks(code: string): Risk[] {
  const found: { index: number; risk: Risk }[] = []
  const seen = new Set<string>()
  for (const { pattern, warning, unless } of RULES) {
    if (seen.has(warning)) continue
    const all = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    const m = [...code.matchAll(all)].find((match) => !unless?.test(match[0]))
    if (!m) continue
    seen.add(warning)
    const text = m[0].trim().replace(/\s+/g, ' ')
    found.push({
      index: m.index ?? 0,
      risk: {
        match: text.length > MAX_MATCH_CHARS ? `${text.slice(0, MAX_MATCH_CHARS - 1)}…` : text,
        warning,
      },
    })
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.risk)
}
