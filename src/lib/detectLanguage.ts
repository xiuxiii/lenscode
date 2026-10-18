import { LANGUAGES, languageFromFileName } from '../data/languages.ts'
import type { LanguageId } from '../types/workspace.ts'

/**
 * Works out which language a piece of code is written in, so the user never
 * has to choose. Runs instantly and offline on every edit.
 *
 * Each language has telltale patterns with a weight ("`def name():`" is very
 * Python; "`git …`" at the start of a line is a terminal command). Every
 * pattern scores its weight per match, up to three matches, so one long file
 * cannot drown out the rest. The highest total wins.
 *
 * - A file extension (`app.py`) is a hint, not a verdict: strong evidence for
 *   another language still wins.
 * - The language a file already has gets a small bonus, so it does not
 *   flicker while someone is typing.
 * - Too little evidence keeps the current language, or reports `plaintext`.
 */

type Signal = readonly [pattern: RegExp, weight: number]

/** Only the start of very large files is inspected. */
const MAX_CHARS = 20_000
/** Below this total there is not enough evidence to name a language. */
const MIN_SCORE = 2
/** Matches beyond this many per pattern add nothing. */
const MAX_MATCHES = 3
const EXTENSION_BONUS = 3
const CURRENT_BONUS = 1

const SHELL_COMMANDS = [
  'sudo', 'git', 'gh', 'npm', 'npx', 'yarn', 'pnpm', 'bun', 'deno', 'node',
  'cd', 'ls', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'touch', 'cat', 'echo',
  'curl', 'wget', 'brew', 'apt', 'apt-get', 'yum', 'dnf', 'chmod', 'chown',
  'grep', 'find', 'tar', 'unzip', 'zip', 'docker', 'docker-compose', 'kubectl',
  'ssh', 'scp', 'source', 'which', 'pip', 'pip3', 'pipx', 'conda', 'python',
  'python3', 'poetry', 'uv', 'cargo', 'rustup', 'go run', 'go build', 'go get',
  'go mod', 'go install', 'make', 'code', 'open', 'clear', 'kill', 'ps', 'top',
  'man', 'history', 'nano', 'vim', 'vercel', 'heroku', 'firebase', 'flutter',
  'java', 'javac', 'gcc', 'g\\+\\+', 'claude',
].join('|')

// Patterns are written once; the `g` flag is added when they are compiled.
const SIGNALS: Partial<Record<LanguageId, Signal[]>> = {
  shell: [
    [/^#!\/(usr\/)?bin\/(env )?(ba|z|da)?sh\b/m, 10],
    [/^\s*\$ \S/m, 4],
    [new RegExp(`^\\s*(${SHELL_COMMANDS})(\\s|$)`, 'm'), 3],
    [/^\s*export [A-Za-z_]\w*=/m, 4],
    [/ \| *(grep|xargs|sort|uniq|head|tail|wc|awk|sed|less|tee|jq)\b/m, 3],
    [/^\s*(fi|done|esac|then)\s*$/m, 3],
    [/^\s*(if|while) \[\[? /m, 4],
    [/\$\{?[A-Z_][A-Z0-9_]*\}?/m, 1],
  ],
  powershell: [
    [/\b(Get|Set|New|Remove|Write|Invoke|Start|Stop|Test|Import|Install|Select|Where|ForEach|Copy|Move)-[A-Z][a-zA-Z]+/m, 5],
    [/\$env:\w+/m, 5],
    [/\s-(ErrorAction|Force|Recurse|Path|LiteralPath|Name|Value|Filter)\b/m, 2],
    [/^\s*param\s*\(/im, 2],
  ],
  python: [
    [/^\s*(async\s+)?def \w+\s*\(.*\)\s*(->\s*[^:]+)?:\s*$/m, 5],
    [/^\s*from [\w.]+ import [\w*, ()]+/m, 5],
    [/^\s*import [\w.]+(\s+as \w+)?\s*$/m, 2],
    [/^\s*class \w+(\([\w., =]*\))?:\s*$/m, 5],
    [/^\s*(if|elif|for|while|with|try|except|else|finally)\b.*:\s*$/m, 2],
    [/\bself\.\w+/m, 2],
    [/^\s*print\(/m, 2],
    [/\b(None|True|False)\b/m, 1],
    [/^if __name__ == ['"]__main__['"]:/m, 8],
    [/\bf["'][^"'\n]*\{/m, 2],
    [/\blambda \w*:/m, 2],
  ],
  javascript: [
    [/\b(const|let|var) [\w${}[\], ]+\s*=/m, 2],
    [/\bfunction\s*\*?\s*[\w$]*\s*\(/m, 3],
    [/=>\s*[{(\w`'"]/m, 2],
    [/\bconsole\.(log|error|warn|info)\(/m, 4],
    [/\b(document|window)\.\w+/m, 3],
    [/\brequire\(['"][^'"]+['"]\)/m, 4],
    [/\bmodule\.exports\b/m, 4],
    [/^\s*import .+ from ['"][^'"]+['"];?\s*$/m, 4],
    [/^\s*export (default |const |let |function |class |async )/m, 3],
    [/===|!==/m, 2],
    [/\.then\(/m, 2],
    [/`[^`]*\$\{[^}]+\}[^`]*`/m, 3],
    [/\bundefined\b/m, 2],
    [/\bJSON\.(parse|stringify)\(/m, 3],
    [/\bclassName=/m, 3],
    [/\bawait \w/m, 1],
  ],
  html: [
    [/<!DOCTYPE html>/im, 10],
    [/<\/?(html|head|body|div|span|p|a|ul|ol|li|h[1-6]|section|header|footer|nav|main|button|form|input|img|table|tr|td|script|style|link|meta|label|select|option|textarea|br|hr|article|aside)\b[^>]*>/im, 3],
    [/<\/[a-z][\w-]*>/m, 1],
  ],
  css: [
    [/^\s*(color|background(-color|-image)?|margin(-\w+)?|padding(-\w+)?|display|font(-size|-weight|-family)?|width|height|max-width|min-height|border(-radius|-\w+)?|position|flex(-\w+)?|grid(-\w+)?|justify-content|align-items|text-align|z-index|opacity|transition|transform|box-shadow|top|left|right|bottom|overflow|cursor|gap|line-height)\s*:\s*[^;]+;/m, 3],
    [/[.#]?[\w-]+[\w\s.#:>+~-]*\{[^}]*\b[a-z-]+\s*:\s*[^;{}]+;[^}]*\}/m, 4],
    [/^\s*@(media|import|keyframes|font-face|tailwind|apply|layer|supports)\b/m, 4],
    [/:(hover|focus|active|before|after|root|nth-child|first-child|last-child)\b/m, 2],
    [/\b\d+(\.\d+)?(px|rem|em|vh|vw)\b/m, 1],
  ],
  json: [[/^\s*"[^"\n]+"\s*:\s*/m, 2]],
  sql: [
    [/\bSELECT\b[\s\S]+?\bFROM\b/im, 6],
    [/\b(INSERT INTO|UPDATE \w+ SET|DELETE FROM|CREATE (TABLE|INDEX|DATABASE|VIEW)|ALTER TABLE|DROP TABLE)\b/im, 6],
    [/\b(WHERE|JOIN|GROUP BY|ORDER BY|LIMIT|VALUES|PRIMARY KEY)\b/m, 2],
  ],
  java: [
    [/\bpublic (abstract )?(final )?class \w+/m, 4],
    [/\bpublic static void main\s*\(\s*String/m, 8],
    [/\bSystem\.out\.print(ln|f)?\(/m, 6],
    [/^\s*import java(x)?\./m, 6],
    [/^\s*package [\w.]+;/m, 4],
    [/@Override\b/m, 3],
    [/\b(private|public|protected) (static )?(final )?(int|String|boolean|void|double|long|List<|Map<)/m, 2],
  ],
  csharp: [
    [/^\s*using System(\.[\w.]+)?;/m, 7],
    [/^\s*namespace [\w.]+\s*[{;]?\s*$/m, 3],
    [/\bConsole\.(WriteLine|Write|ReadLine)\(/m, 6],
    [/\{\s*get;\s*(set;|init;)?\s*\}/m, 5],
    [/\b(public|private|internal|protected) (async |static |override |virtual )*(Task|string|int|void|bool)\b/m, 2],
  ],
  c: [
    [/^\s*#include\s*[<"][\w./]+[>"]/m, 6],
    [/\bint main\s*\(/m, 3],
    [/\b(printf|scanf|malloc|free|fprintf)\(/m, 3],
  ],
  cpp: [
    [/^\s*#include\s*[<"][\w./]+[>"]/m, 6],
    [/\bint main\s*\(/m, 3],
    [/\bstd::\w+/m, 5],
    [/\b(cout|cin|endl)\b/m, 4],
    [/\btemplate\s*</m, 4],
    [/\busing namespace std;/m, 6],
  ],
  go: [
    [/^\s*package \w+\s*$/m, 5],
    [/^\s*func (\(\w+ \*?\w+\) )?\w+\(/m, 5],
    [/:=/m, 2],
    [/\bfmt\.(Print|Sprint|Errorf|Fprint)/m, 6],
    [/^\s*import \(\s*$/m, 4],
    [/\berr != nil\b/m, 5],
  ],
  rust: [
    [/\bfn \w+(<[^>]*>)?\s*\(/m, 5],
    [/\blet mut \w+/m, 5],
    [/\b(println|print|format|vec|panic|assert|assert_eq|eprintln|write|writeln)!\(/m, 4],
    [/^\s*use (std|crate|super|self)::/m, 6],
    [/^\s*(pub )?(struct|enum|trait|impl|mod) \w+/m, 3],
    [/->\s*(Self|Result<|Option<|Vec<|String|&str|i32|i64|u32|u64|usize|bool)\b/m, 4],
    [/&(mut )?(self|str)\b/m, 3],
    [/\.unwrap\(\)/m, 4],
  ],
  php: [
    [/<\?php/m, 12],
    [/\$[a-z_]\w*\s*=\s*[^=]/m, 2],
    // PHP statements end in ";"; shell and PowerShell lines usually do not.
    [/^\s*(echo|return|\$\w+\s*=).*\$\w+.*;\s*$|^\s*\$\w+\s*=.*;\s*$/m, 3],
    [/\$this->/m, 5],
    [/\bfunction \w+\s*\([^)]*\$\w+/m, 5],
    [/\becho\s+["'$]/m, 1],
  ],
  ruby: [
    [/^\s*def \w+[?!]?(\(.*\))?\s*$/m, 3],
    [/^\s*end\s*$/m, 2],
    [/\bputs\b/m, 3],
    [/^\s*require ['"][\w/-]+['"]\s*$/m, 3],
    [/\bdo\s*\|\w+(, *\w+)*\|/m, 5],
    [/^\s*attr_(accessor|reader|writer)\b/m, 5],
    [/@\w+\s*=[^=]/m, 2],
  ],
  yaml: [
    [/^\s*[\w.-]+:\s+[^\s{][^;,{]*$/m, 1],
    [/^\s*- [\w"'[{$]/m, 1],
    [/^---\s*$/m, 2],
    [/^(name|on|jobs|steps|runs-on|uses|services|image|version|env|with|ports|volumes|apiVersion|kind|metadata|spec|dependencies|scripts):/m, 2],
  ],
  markdown: [
    [/^#{1,6} \S/m, 2],
    [/\[[^\]\n]+\]\([^)\n]+\)/m, 3],
    [/^```/m, 3],
    [/\*\*[^*\n]+\*\*/m, 2],
    [/^\s*([-*]|\d+\.) \S/m, 1],
    [/^> \S/m, 1],
  ],
  dockerfile: [
    [/^FROM [\w./-]+(:[\w.-]+)?( AS \w+)?\s*$/m, 5],
    [/^(RUN|COPY|ADD|WORKDIR|CMD|ENTRYPOINT|EXPOSE|ENV|ARG|USER|VOLUME|LABEL)\s+\S/m, 4],
  ],
}

/** Markers only TypeScript has; when present they stack on the JavaScript score. */
const TYPESCRIPT_ONLY: Signal[] = [
  [/^\s*(export\s+)?interface \w+(<[^>]+>)?\s*(extends [\w<>, ]+)?\{/m, 5],
  [/^\s*(export\s+)?type \w+(<[^>]+>)?\s*=/m, 5],
  [/[\w)\]?]\s*:\s*(string|number|boolean|any|void|unknown|never|Promise<|Record<|Array<)/m, 3],
  [/\bas (const|string|number|unknown|any)\b/m, 3],
  [/\b(private|protected|readonly) \w+\s*[:(]/m, 2],
  [/^\s*(export\s+)?enum \w+\s*\{/m, 2],
]

const compile = (signals: Signal[]): Signal[] =>
  signals.map(([re, w]) => [new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`), w])

const COMPILED = Object.fromEntries(
  Object.entries(SIGNALS).map(([id, signals]) => [id, compile(signals!)]),
) as Partial<Record<LanguageId, Signal[]>>
const COMPILED_TS = compile(TYPESCRIPT_ONLY)

/** Ties go to the language listed first in `LANGUAGES`. */
const ORDER = LANGUAGES.map((l) => l.id)

function score(text: string, signals: Signal[]): number {
  let total = 0
  for (const [re, weight] of signals) {
    re.lastIndex = 0
    const matches = text.match(re)?.length ?? 0
    total += weight * Math.min(matches, MAX_MATCHES)
  }
  return total
}

function isJsonDocument(text: string): boolean {
  const t = text.trim()
  if (!/^[[{]/.test(t)) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

export interface DetectOptions {
  /** Its extension, if any, is used as a hint. */
  fileName?: string
  /** The language the file has now; kept unless the evidence says otherwise. */
  current?: LanguageId
}

/** Score every language. Exported for tests and debugging. */
export function scoreLanguages(content: string): Map<LanguageId, number> {
  const text = content.slice(0, MAX_CHARS)
  const scores = new Map<LanguageId, number>()
  for (const id of ORDER) {
    const signals = COMPILED[id]
    if (signals) scores.set(id, score(text, signals))
  }
  const typescriptMarkers = score(text, COMPILED_TS)
  if (typescriptMarkers > 0) {
    scores.set('typescript', (scores.get('javascript') ?? 0) + typescriptMarkers)
  }
  if (isJsonDocument(text)) scores.set('json', (scores.get('json') ?? 0) + 12)
  return scores
}

export function detectLanguage(content: string, options: DetectOptions = {}): LanguageId {
  const hinted = options.fileName ? languageFromFileName(options.fileName) : null
  const current = options.current && options.current !== 'plaintext' ? options.current : null

  if (!content.trim()) return hinted ?? 'plaintext'

  const scores = scoreLanguages(content)
  let best: LanguageId | null = null
  let bestScore = 0
  for (const id of ORDER) {
    let s = scores.get(id) ?? 0
    if (s === 0) continue
    if (id === hinted) s += EXTENSION_BONUS
    if (id === current) s += CURRENT_BONUS
    if (s > bestScore) {
      best = id
      bestScore = s
    }
  }

  if (best && bestScore >= MIN_SCORE) return best
  return current ?? hinted ?? 'plaintext'
}
