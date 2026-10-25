/**
 * Hides API keys, passwords, tokens and private keys in code before it is
 * sent to the AI, so explaining a config file or a pasted terminal command
 * never hands someone's credentials to a third party.
 *
 *   const API_KEY = "sk-proj-…"   →   const API_KEY = "[hidden secret]"
 *
 * Only the value is replaced, so the code still reads naturally and can be
 * explained. Line breaks are never added or removed (a private key block
 * keeps its line count), so line numbers stay right.
 *
 * Plain string work with no Node or browser APIs, so it runs anywhere.
 * Patterns favour hiding: a harmless value hidden by mistake costs a little
 * detail in the explanation, while a key that gets through cannot be taken
 * back. The exceptions are obvious placeholders and code that fetches a
 * secret from elsewhere (`process.env.API_KEY`, `getToken()`): neither holds
 * a secret, and both matter to the explanation.
 */

export const HIDDEN_SECRET = '[hidden secret]'

export interface MaskedText {
  text: string
  /** How many values were hidden. */
  count: number
}

/** Stand-ins for a secret: `your-key-here`, `xxxxxxxx`, `<token>`, `sk-...`, `changeme`. */
const PLACEHOLDER =
  /^(<.*>|\[.*\]|\{\{.*\}\})$|^[x*._\- ]+$|x{6,}|\*{3,}|\.{3}|…|^your[-_ ]|[-_ ]here$|change[-_ ]?me|placeholder|example|redacted|dummy/i
/** `$API_KEY`, `${API_KEY}`, `$(cat key.txt)`, `%API_KEY%`: the secret is kept elsewhere. */
const ENV_REFERENCE = /^(\$|%\w+%$)/

// Every pattern is bounded or anchored so that it runs in linear time, even
// on a 500 KB minified file: no unbounded backtracking.

/** A key body is base64 plus headers (`Proc-Type: 4,ENCRYPTED`), quotes and `\n` escapes, never `--`. */
const PRIVATE_KEY =
  /(-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----)((?:[\w+/=\s"'`\\:,.]|-(?!-)){0,20000}?)(-----END [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----|$)/g
/** What a real key body has and code that merely names the markers lacks. */
const KEY_MATERIAL = /[A-Za-z0-9+/]{16}/

/** Patterns where only the second group is the secret. */
const PREFIXED = [
  // scheme://user:password@host: the password only
  /\b([a-z][a-z0-9+.-]{0,20}:\/\/[^\s:/?#@'"`]{0,200}:)([^\s/?#@'"`]{1,200})(?=@)/gi,
  // AWS secret access keys: 40 characters after their name, even in `aws configure set …`
  /\b((?:aws_?)?secret_?access_?key["']?[ \t]*[:=]?[ \t]*["']?)([A-Za-z0-9/+]{40})(?![A-Za-z0-9/+])/gi,
]

/** Recognisable on their own, wherever they appear. */
const TOKENS = [
  // OpenAI, Anthropic and DeepSeek keys: sk-…, sk-proj-…, sk-ant-api03-…
  /(?<![\w-])sk-[\w-]{20,}/g,
  // AWS access key ids
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  // GitHub tokens: personal, OAuth, user-to-server, server-to-server, refresh, fine-grained
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,})/g,
  // Slack tokens
  /(?<![\w-])xox[abpors]-[A-Za-z0-9-]{10,}/g,
  // Google API keys
  /(?<![\w-])AIza[\w-]{20,}/g,
  // Stripe live secret and restricted keys
  /\b[rs]k_live_[A-Za-z0-9]{10,}/g,
  // JSON Web Tokens: header.payload.signature
  /(?<![\w-])eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]*/g,
  // Authorization: Bearer <token>
  /(?<=\b[Bb]earer[ \t]{1,10})[\w.~+/-]{16,}=*/g,
]

/**
 * Real keys and tokens are random: a digit, or a capital letter after the
 * first character. Words are not: `sk-spinner-pulse`, `Bearer authentication`.
 */
const RANDOM = /\d|.[A-Z]/

/**
 * `name = value`, `name: value`, `name := value`, `name => value` and a typed
 * `name: str = value`, on one line. A quoted name may close an index
 * (`config['SECRET_KEY'] = …`) or open a call (`define('DB_PASSWORD', …)`).
 * The name is matched whole (the lookahead), so it is never backtracked into,
 * and at most 512 characters of a bare value are read until it proves secret.
 */
const ASSIGNMENT =
  /(?<![\w$])(?=([A-Za-z_$][\w$.-]{0,63}))\1(["']?\]?)([ \t]*(?::[ \t]*[A-Za-z_][\w.<>[\]| ]*?[ \t]*=(?!=)|=>|:=|=(?!=)|:|,)[ \t]*)("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`\n]*`|[^\s"'`;,()[\]{}<>]{1,512})/g
/** The rest of a long bare value, such as a base64 certificate, once it is known to be a secret. */
const BARE_REST = /[^\s"'`;,()[\]{}<>]*/y

/** A word of the name ends in one of these: apiKey, AUTH_TOKEN, client_secret, db.passwd, DB_PASS. */
const SECRET_WORD = /(key|token|secret|passw(or)?d|pwd|auth(orization)?)$|^pass$/i
const MIN_ASSIGNED_CHARS = 8

/** URLs and file paths say where something is (passwords inside URLs are caught above). */
const LOCATION = /^([a-z][a-z0-9+.-]*:\/\/|~?\.{0,2}[\\/]|[a-z]:\\)/i
/** Three or more words read as a sentence: "Password must be at least 8 characters." */
const PROSE = /^(?=\S+\s+\S+\s+\S)([A-Z][a-z]|.*[.?!:]$)/

function isSecretName(name: string): boolean {
  const words = name.split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/)
  return words.some((word) => SECRET_WORD.test(word))
}

/**
 * Whether an assigned value is written out in the code, rather than code
 * that produces it. A bare word is a variable (`password: newPassword`),
 * except in .env files and shell commands (`API_KEY=abcdefgh`).
 */
function isLiteral(value: string, quoted: boolean, envStyle: boolean, next: string): boolean {
  if (value.length < MIN_ASSIGNED_CHARS || LOCATION.test(value)) return false
  if (quoted) return !/[$#]\{/.test(value) && !PROSE.test(value)
  if (next === '(' || next === '[') return false
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(value)) return false
  return envStyle || !/^[A-Za-z_$]+$/.test(value)
}

function maskAssignments(text: string, hide: (secret: string) => string): string {
  let out = ''
  let copied = 0
  ASSIGNMENT.lastIndex = 0
  for (let m = ASSIGNMENT.exec(text); m; m = ASSIGNMENT.exec(text)) {
    const [match, name, quote, operator, value] = m
    let end = m.index + match.length
    const quoted = /^["'`]/.test(value)
    const inner = quoted ? value.slice(1, -1) : value
    const envStyle = operator === '=' && /^[A-Z][A-Z0-9_]*$/.test(name)
    // `name, value` only as the first two arguments of a call.
    const pairOk =
      !operator.includes(',') ||
      (quote !== '' && /\(\s*["']$/.test(text.slice(Math.max(0, m.index - 8), m.index)))
    const secret = pairOk && isSecretName(name) && isLiteral(inner, quoted, envStyle, text[end])
    const hidden = secret ? hide(inner) : inner
    if (hidden === inner) {
      // Not a secret. Look again just after the name, so a value read as
      // part of this match still gets checked on its own.
      ASSIGNMENT.lastIndex = m.index + name.length
      continue
    }
    out += text.slice(copied, end - value.length) + (quoted ? value[0] + hidden + value[0] : hidden)
    if (!quoted) {
      BARE_REST.lastIndex = end
      end += BARE_REST.exec(text)?.[0].length ?? 0
    }
    copied = end
    ASSIGNMENT.lastIndex = end
  }
  return out + text.slice(copied)
}

/** One `[hidden secret]` in place of a key's lines, keeping every line break and the END line's indent. */
function blankKeyLines(body: string): string {
  let shown = false
  const lines = body.split('\n')
  return lines
    .map((line, i) => {
      if (!line.trim()) return line
      const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
      if (shown) return i === lines.length - 1 ? indent : ''
      shown = true
      return indent + HIDDEN_SECRET
    })
    .join('\n')
}

/** `text` with secret-looking values replaced by `[hidden secret]`, and how many there were. */
export function maskSecrets(text: string): MaskedText {
  let count = 0
  const hide = (secret: string): string => {
    const standIn = PLACEHOLDER.test(secret) || ENV_REFERENCE.test(secret)
    if (standIn || secret.includes(HIDDEN_SECRET)) return secret
    count++
    return HIDDEN_SECRET
  }

  // Key blocks first, so their lines are not picked apart by the rules below.
  // A block cut off before its END line is hidden to the end of the text.
  let masked = text.replace(PRIVATE_KEY, (block, begin: string, body: string, end: string) =>
    KEY_MATERIAL.test(body) && hide(body) !== body ? begin + blankKeyLines(body) + end : block,
  )
  for (const pattern of PREFIXED) {
    masked = masked.replace(pattern, (_match, prefix: string, secret: string) => prefix + hide(secret))
  }
  for (const pattern of TOKENS) {
    masked = masked.replace(pattern, (token) => (RANDOM.test(token) ? hide(token) : token))
  }
  return { text: maskAssignments(masked, hide), count }
}
