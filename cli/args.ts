/** How the explanation is delivered. */
export type Output = 'text' | 'json' | 'popup' | 'open'

/** What the command line asks for. */
export type Command =
  | { kind: 'explain'; output: Output; text: string | null }
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'setup-mac' }
  | { kind: 'setup-zsh' }
  | { kind: 'error'; message: string }

const OUTPUTS = new Map<string, Output>([
  ['--json', 'json'],
  ['--popup', 'popup'],
  ['--open', 'open'],
])
const OTHERS = new Map<string, Command>([
  ['-h', { kind: 'help' }],
  ['--help', { kind: 'help' }],
  ['-v', { kind: 'version' }],
  ['--version', { kind: 'version' }],
  ['--setup-mac', { kind: 'setup-mac' }],
  ['--setup-zsh', { kind: 'setup-zsh' }],
])

/**
 * Options come first. The first word that is not an option starts the text,
 * so `lens git push --force` explains "git push --force"; `--` ends the
 * options early, for text that starts with a dash. `--help` wins over
 * everything else.
 */
export function parseArgs(argv: string[]): Command {
  const outputs: Output[] = []
  let help = false
  let other: Command | null = null
  let i = 0
  for (; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') {
      i++
      break
    }
    if (!arg.startsWith('-') || arg === '-') break
    const output = OUTPUTS.get(arg)
    const command = OTHERS.get(arg)
    if (output) outputs.push(output)
    else if (command?.kind === 'help') help = true
    else if (command) other = command
    else {
      return {
        kind: 'error',
        message: `Unknown option ${arg}. To explain text that starts with a dash, put -- before it: lens -- ${arg}`,
      }
    }
  }
  if (help) return { kind: 'help' }
  if (other) return other
  if (new Set(outputs).size > 1) {
    return { kind: 'error', message: 'Use only one of --open, --popup and --json.' }
  }
  const text = argv.slice(i).join(' ')
  return { kind: 'explain', output: outputs[0] ?? 'text', text: text || null }
}

/** `lens --help`. `folder` is the LensCode folder, where the key is read from. */
export function helpText(folder: string): string {
  return `lens explains code and terminal commands in plain English. It never runs them.

Usage
  lens 'git push --force'   explain the text you give it
  pbpaste | lens            explain what you copied (Mac)
  lens < script.sh          explain a file (up to 8,000 characters)

Options (put them before the text)
  --open         explain it in LensCode, in your browser
  --popup        show the explanation in a Mac dialog box
  --json         print the explanation as JSON
  --setup-mac    how to explain highlighted text with a keyboard shortcut on a Mac
  --setup-zsh    a zsh shortcut (Ctrl+X Ctrl+L) that explains the command you are typing
  -h, --help     show this help
  -v, --version  show the version

Put the text in single quotes, or pipe it in: inside double quotes, your
shell still runs $(…) and \`…\` before lens ever sees them.

The AI key is LLM_API_KEY, from your shell or from .env.local in
${folder}
`
}
