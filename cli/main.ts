import { dirname, join } from 'node:path'
import { version } from '../package.json'
import { readLlmConfig, type LlmConfig } from '../server/explain/config.ts'
import { createExplainHandler } from '../server/explain/handler.ts'
import { buildExplainUrl, MAX_EXPLAIN_CHARS, tidyText } from '../src/lib/deepLink.ts'
import { detectLanguage } from '../src/lib/detectLanguage.ts'
import { findRisks } from '../src/lib/riskyCommands.ts'
import { wholeRange } from '../src/lib/selection.ts'
import type { Explanation, ExplanationRequest } from '../src/types/explanation.ts'
import { helpText, parseArgs, type Output } from './args.ts'
import { loadEnv, type Env } from './env.ts'
import { colorEnabled, createStyle, formatExplanation, formatRisks } from './format.ts'
import { choseOpen, dialogScript } from './popup.ts'
import { setupMacText, setupZshText, shellQuote } from './setup.ts'

/**
 * The `lens` command. Everything it needs from the outside world comes in
 * through `CliContext`, so tests can run it with a fake AI, terminal and
 * browser. It explains the text it is given and never runs it.
 */

export const DEFAULT_LENSCODE_URL = 'http://localhost:5173'

export interface Terminal {
  write: (text: string) => void
  isTTY: boolean
}

export interface CliContext {
  argv: string[]
  env: Env
  /** Everything piped in, or null when nothing is (stdin is a terminal). */
  readStdin: () => Promise<string | null>
  stdout: Terminal
  stderr: Terminal
  platform: NodeJS.Platform
  /** This script's path. The LensCode folder is the one above it. */
  scriptPath: string
  /** The Node binary running it (`process.execPath`). */
  nodePath: string
  /** Start a program and leave it running; false if it could not start. */
  launch: (command: string, args: string[]) => Promise<boolean>
  /** Run a program to the end; what it printed, or null if it failed. */
  capture: (command: string, args: string[]) => Promise<string | null>
}

/**
 * Explain `text` with the engine behind the web app's `POST /api/explain`,
 * as if all of it were selected. Rejects with the engine's own message.
 */
export async function explainText(text: string, config: LlmConfig): Promise<Explanation> {
  const request: ExplanationRequest = {
    selectedCode: text,
    language: detectLanguage(text),
    surroundingContext: { fullSource: text, range: wholeRange(text) },
  }
  const response = await createExplainHandler({ config })(
    new Request('http://localhost/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),
  )
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
  if (!response.ok || !body) {
    throw new Error(body?.error?.message ?? `Something went wrong (HTTP ${response.status}).`)
  }
  return body as Explanation
}

/** How each system opens a link in the default browser. */
export function browserCommand(platform: NodeJS.Platform, url: string): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]]
  // `start` takes its first quoted argument as a window title, hence the "".
  if (platform === 'win32') return ['cmd', ['/c', 'start', '""', url]]
  return ['xdg-open', [url]]
}

/** Whether anything answers at `url`: is LensCode (npm run dev) up? */
async function isRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
    void response.body?.cancel()
    return true
  } catch {
    return false
  }
}

const NOTHING_TO_EXPLAIN =
  "Nothing to explain. Give lens some text, like lens 'git status', or pipe it in: pbpaste | lens"

function tooLong(length: number): string {
  return `That is ${length.toLocaleString('en-US')} characters, and LensCode explains at most ${MAX_EXPLAIN_CHARS.toLocaleString('en-US')} at a time. Pick a smaller piece.`
}

function noKey(folder: string): string {
  return `lens needs an AI key. Add this line to ${join(folder, '.env.local')}
(or set LLM_API_KEY in your shell):

  LLM_API_KEY=your-key

Get a DeepSeek key at https://platform.deepseek.com/api_keys, or see
.env.example in the same folder to use another provider.`
}

export async function main(ctx: CliContext): Promise<number> {
  const folder = dirname(dirname(ctx.scriptPath))
  const paths = { node: ctx.nodePath, script: ctx.scriptPath }
  const command = parseArgs(ctx.argv)
  switch (command.kind) {
    case 'error':
      ctx.stderr.write(`${command.message}\nRun lens --help to see how to use it.\n`)
      return 1
    case 'help':
      ctx.stdout.write(helpText(folder))
      return 0
    case 'version':
      ctx.stdout.write(`lens ${version}\n`)
      return 0
    case 'setup-mac':
      ctx.stdout.write(setupMacText(paths))
      return 0
    case 'setup-zsh':
      ctx.stdout.write(setupZshText(paths))
      return 0
    case 'explain':
      return explain(ctx, command.output, command.text, folder)
  }
}

async function explain(
  ctx: CliContext,
  requested: Output,
  argText: string | null,
  folder: string,
): Promise<number> {
  const env = loadEnv(folder, ctx.env)
  const popup = requested === 'popup' && ctx.platform === 'darwin'
  const output = requested === 'popup' && !popup ? 'text' : requested
  if (requested === 'popup' && !popup) {
    ctx.stderr.write('--popup needs macOS, so here it is in the terminal instead.\n')
  }

  const style = createStyle(!popup && colorEnabled(ctx.stdout.isTTY, ctx.env))
  const errStyle = createStyle(colorEnabled(ctx.stderr.isTTY, ctx.env))
  // Arguments win; stdin is only read when there are none.
  const text = tidyText(argText ?? (await ctx.readStdin()) ?? '')
  // The app's own warnings, decided here and not by the AI, come first.
  const risks = findRisks(text)

  // Where messages go: the dialog for --popup (it may run with no terminal),
  // otherwise warnings on stdout (stderr for --json) and errors on stderr.
  const showDialog = async (body: string): Promise<void> => {
    const message = formatRisks(risks, style) + body
    const answer = await ctx.capture('osascript', [
      '-e',
      dialogScript(message, { caution: risks.length > 0 }),
    ])
    if (answer === null) ctx.stdout.write(`${message}\n`)
    if (choseOpen(answer)) await openInLensCode(ctx, env, text, folder)
  }
  const showRisks = () => {
    if (output === 'json') ctx.stderr.write(formatRisks(risks, errStyle))
    else ctx.stdout.write(formatRisks(risks, style))
  }
  const fail = async (message: string): Promise<number> => {
    if (popup) await showDialog(message)
    else ctx.stderr.write(`${message}\n`)
    return 1
  }

  if (!text.trim()) return fail(popup ? 'Nothing to explain. Highlight some text first.' : NOTHING_TO_EXPLAIN)
  if (!popup) showRisks()
  if (text.length > MAX_EXPLAIN_CHARS) return fail(tooLong(text.length))

  if (output === 'open') return (await openInLensCode(ctx, env, text, folder)) ? 0 : 1

  const config = readLlmConfig(env)
  if (!config) return fail(noKey(folder))

  const status = !popup && ctx.stderr.isTTY
  if (status) ctx.stderr.write('Explaining…')
  let explanation: Explanation
  try {
    explanation = await explainText(text, config)
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  } finally {
    if (status) ctx.stderr.write('\r\x1b[2K')
  }

  if (popup) await showDialog(formatExplanation(explanation, style))
  else if (output === 'json') ctx.stdout.write(`${JSON.stringify(explanation, null, 2)}\n`)
  else ctx.stdout.write(formatExplanation(explanation, style))
  return 0
}

/** Open the text in LensCode in the browser (`--open`, or the dialog's button). */
async function openInLensCode(
  ctx: CliContext,
  env: Env,
  text: string,
  folder: string,
): Promise<boolean> {
  const base = env.LENSCODE_URL?.trim() || DEFAULT_LENSCODE_URL
  let url: string
  try {
    url = buildExplainUrl(base, text)
  } catch {
    ctx.stderr.write(`LENSCODE_URL is not a web address: ${base}\n`)
    return false
  }
  const [command, args] = browserCommand(ctx.platform, url)
  const [opened, running] = await Promise.all([ctx.launch(command, args), isRunning(url)])
  ctx.stdout.write(
    opened
      ? `Opening LensCode in your browser:\n${url}\n`
      : `Could not open your browser. Open this link yourself:\n${url}\n`,
  )
  if (!running) {
    ctx.stdout.write(
      `LensCode does not seem to be running at ${base}. Start it, then reload the page:\n  cd ${shellQuote(folder)} && npm run dev\n`,
    )
  }
  return opened
}
