import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserCommand, main, type CliContext } from './main'

/**
 * Runs the whole `lens` command against a fake AI (a stubbed `fetch`), with
 * a fake terminal, browser and dialog. Nothing touches the network.
 */

const LLM_URL = 'https://llm.example'
const KEY_ENV = { LLM_API_KEY: 'sk-test', LLM_BASE_URL: LLM_URL }

const ANSWER = {
  title: 'Force push',
  kind: 'statement',
  whatIsIt: 'Uploads your commits and replaces what is on the server.',
  technicalDefinition: 'Updates the remote branch even when it is not an ancestor.',
  inThisCode: 'Here "git push --force" overwrites the branch.',
  whyItsHere: 'Used after rewriting history.',
  relatedConcepts: [{ name: 'Remote', explanation: 'the copy on a server' }],
}

function completion(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

/** The fake AI answers at LLM_URL; LensCode itself answers only when `lensCodeUp`. */
function mockFetch({ status = 200, lensCodeUp = false } = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith(LLM_URL)) {
      return status === 200 ? completion(JSON.stringify(ANSWER)) : new Response('{}', { status })
    }
    if (lensCodeUp) return new Response('<!doctype html>')
    throw new TypeError('fetch failed')
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** What the fake AI was asked, from the one call to it. */
function promptSent(fetchMock: ReturnType<typeof mockFetch>): string {
  const calls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith(LLM_URL))
  expect(calls).toHaveLength(1)
  return JSON.parse(String(calls[0][1]?.body)).messages[1].content
}

function expectInOrder(text: string, parts: string[]) {
  for (const part of parts) expect(text).toContain(part)
  const positions = parts.map((part) => text.indexOf(part))
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
}

let folder: string
beforeEach(() => {
  // The LensCode folder lens thinks it lives in, so no real .env file is read.
  folder = mkdtempSync(join(tmpdir(), 'lens-main-'))
})
afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

interface Fake {
  stdin?: string | null
  env?: Record<string, string>
  platform?: NodeJS.Platform
  stdoutTTY?: boolean
  stderrTTY?: boolean
  browserOpens?: boolean
  /** What osascript prints; null when the dialog could not be shown. */
  dialogAnswer?: string | null
}

async function run(argv: string[], fake: Fake = {}) {
  const out: string[] = []
  const err: string[] = []
  const launched: string[][] = []
  const dialogs: string[] = []
  const readStdin = vi.fn(async () => fake.stdin ?? null)
  const ctx: CliContext = {
    argv,
    env: fake.env ?? KEY_ENV,
    readStdin,
    stdout: { write: (text) => out.push(text), isTTY: fake.stdoutTTY ?? false },
    stderr: { write: (text) => err.push(text), isTTY: fake.stderrTTY ?? false },
    platform: fake.platform ?? 'linux',
    scriptPath: join(folder, 'dist-cli', 'lens.mjs'),
    nodePath: '/usr/local/bin/node',
    launch: async (command, args) => {
      launched.push([command, ...args])
      return fake.browserOpens ?? true
    },
    capture: async (command, args) => {
      expect(command).toBe('/usr/bin/osascript')
      dialogs.push(args[1])
      return fake.dialogAnswer === undefined ? 'button returned:OK\n' : fake.dialogAnswer
    },
  }
  const code = await main(ctx)
  return { code, out: out.join(''), err: err.join(''), launched, dialogs, readStdin }
}

describe('lens: explaining', () => {
  it('prints the warning, title, answer, both sections and related concepts, in order', async () => {
    mockFetch()
    const { code, out, err } = await run(['git push --force'])
    expect(code).toBe(0)
    expect(err).toBe('')
    expectInOrder(out, [
      'Careful before you run this',
      '  • git push --force — Replaces the history on the server with yours.',
      'Force push',
      'Uploads your commits and replaces what is on the server.',
      'In this code',
      'Here "git push --force" overwrites the branch.',
      'Why it’s here',
      'Related concepts',
      '  • Remote — the copy on a server',
    ])
  })

  it('asks the shared engine, with the language detected and all of the text selected', async () => {
    const fetchMock = mockFetch()
    await run(['for f in *.txt; do\n  echo "$f"\ndone'])
    const prompt = promptSent(fetchMock)
    expect(prompt).toContain('Language (auto-detected): Terminal command')
    expect(prompt).toContain('The user highlighted this, on lines 1–3:')
    expect(prompt).toContain('> 3 | done')
  })

  it('reads piped-in text when there are no arguments', async () => {
    const fetchMock = mockFetch()
    const { code, readStdin } = await run([], { stdin: '\nnpm install\r\n' })
    expect(code).toBe(0)
    expect(readStdin).toHaveBeenCalled()
    expect(promptSent(fetchMock)).toContain('<<<SELECTION\nnpm install\nSELECTION>>>')
  })

  it('prefers arguments over piped-in text, without reading it', async () => {
    const fetchMock = mockFetch()
    const { readStdin } = await run(['git status'], { stdin: 'ls -la' })
    expect(readStdin).not.toHaveBeenCalled()
    expect(promptSent(fetchMock)).toContain('<<<SELECTION\ngit status\nSELECTION>>>')
  })

  it('says when there is nothing to explain', async () => {
    const fetchMock = mockFetch()
    const { code, out, err } = await run([], { stdin: null })
    expect(code).toBe(1)
    expect(out).toBe('')
    expect(err).toContain('Nothing to explain.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('turns down text over 8,000 characters without asking the AI', async () => {
    const fetchMock = mockFetch()
    const { code, err } = await run([], { stdin: 'x'.repeat(8_001) })
    expect(code).toBe(1)
    expect(err).toContain('That is 8,001 characters, and LensCode explains at most 8,000 at a time.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts exactly 8,000 characters', async () => {
    mockFetch()
    expect((await run([], { stdin: 'x'.repeat(8_000) })).code).toBe(0)
  })

  it('still shows the warnings when the AI fails, then its error', async () => {
    mockFetch({ status: 401 })
    const { code, out, err } = await run(['sudo rm -rf /'])
    expect(code).toBe(1)
    expect(out).toContain('Careful before you run this')
    expect(out).toContain('sudo')
    expect(out).toContain('rm -rf')
    expect(err).toBe('The LLM provider rejected the API key. Check LLM_API_KEY in .env.local.\n')
  })

  it('says how to add a key when there is none, and still warns', async () => {
    const fetchMock = mockFetch()
    const { code, out, err } = await run(['git push --force'], { env: {} })
    expect(code).toBe(1)
    expect(out).toContain('Careful before you run this')
    expect(err).toContain(join(folder, '.env.local'))
    expect(err).toContain('LLM_API_KEY=your-key')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads the key from .env.local in the LensCode folder', async () => {
    writeFileSync(join(folder, '.env.local'), `LLM_API_KEY=sk-file\nLLM_BASE_URL=${LLM_URL}\n`)
    const fetchMock = mockFetch()
    const { code } = await run(['ls'], { env: {} })
    expect(code).toBe(0)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-file')
  })

  it('prints only the explanation JSON on stdout with --json, warnings on stderr', async () => {
    mockFetch()
    const { code, out, err } = await run(['--json', 'git push --force'])
    expect(code).toBe(0)
    expect(JSON.parse(out)).toMatchObject({
      selectedCode: 'git push --force',
      language: 'shell',
      concept: 'Force push',
      relatedConcepts: [{ label: 'Remote', hint: 'the copy on a server' }],
    })
    expect(err).toContain('Careful before you run this')
  })

  it('colours the output only on a terminal, and not with NO_COLOR', async () => {
    mockFetch()
    expect((await run(['ls'], { stdoutTTY: true })).out).toContain('\x1b[1mForce push\x1b[22m')
    const noColor = await run(['ls'], { stdoutTTY: true, env: { ...KEY_ENV, NO_COLOR: '1' } })
    expect(noColor.out).not.toContain('\x1b')
    expect((await run(['ls'])).out).not.toContain('\x1b')
  })

  it('shows "Explaining…" while it waits, on a terminal, and clears it', async () => {
    mockFetch()
    const { err } = await run(['ls'], { stderrTTY: true })
    expect(err).toBe('Explaining…\r\x1b[2K')
  })
})

describe('lens --open', () => {
  it('opens the deep link in the browser, and needs no key', async () => {
    const fetchMock = mockFetch({ lensCodeUp: true })
    const { code, out, launched } = await run(['--open', 'git status'], { env: {} })
    expect(code).toBe(0)
    expect(launched).toEqual([['xdg-open', 'http://localhost:5173/#explain=git%20status']])
    expect(out).toContain('Opening LensCode in your browser:\nhttp://localhost:5173/#explain=git%20status\n')
    expect(out).not.toContain('npm run dev')
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith(LLM_URL))).toBe(false)
  })

  it('uses LENSCODE_URL', async () => {
    mockFetch({ lensCodeUp: true })
    const { launched } = await run(['--open', 'ls'], { env: { LENSCODE_URL: 'http://localhost:5182' } })
    expect(launched[0][1]).toBe('http://localhost:5182/#explain=ls')
  })

  it('says how to start LensCode when it is not running', async () => {
    mockFetch({ lensCodeUp: false })
    const { code, out } = await run(['--open', 'ls'])
    expect(code).toBe(0)
    expect(out).toContain('LensCode does not seem to be running at http://localhost:5173.')
    expect(out).toContain(`cd ${folder} && npm run dev`)
  })

  it('prints the link when no browser opens', async () => {
    mockFetch({ lensCodeUp: true })
    const { code, out } = await run(['--open', 'ls'], { browserOpens: false })
    expect(code).toBe(1)
    expect(out).toContain('Could not open your browser. Open this link yourself:\nhttp://localhost:5173/#explain=ls\n')
  })

  it('shows the warnings first', async () => {
    mockFetch({ lensCodeUp: true })
    const { out } = await run(['--open', 'rm -rf build'])
    expect(out.startsWith('Careful before you run this\n')).toBe(true)
  })

  it('turns down a LENSCODE_URL that is not a web address', async () => {
    mockFetch()
    const { code, err, launched } = await run(['--open', 'ls'], { env: { LENSCODE_URL: 'localhost 5173' } })
    expect(code).toBe(1)
    expect(err).toContain('LENSCODE_URL is not a web address')
    expect(launched).toEqual([])
  })
})

describe('browserCommand', () => {
  it('uses open on macOS, start on Windows and xdg-open elsewhere', () => {
    const url = 'http://localhost:5173/#explain=ls'
    expect(browserCommand('darwin', url)).toEqual(['/usr/bin/open', [url]])
    expect(browserCommand('win32', url)).toEqual(['cmd', ['/c', 'start', '""', url]])
    expect(browserCommand('linux', url)).toEqual(['xdg-open', [url]])
  })
})

describe('lens --popup', () => {
  it('shows the warnings, then the explanation, in a macOS dialog', async () => {
    mockFetch()
    const { code, out, dialogs } = await run(['--popup'], { platform: 'darwin', stdin: 'git push --force' })
    expect(code).toBe(0)
    expect(out).toBe('')
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]).toMatch(/^display dialog "Careful before you run this\\n {2}• git push --force — /)
    expectInOrder(dialogs[0], ['Careful', 'Force push', 'In this code', 'Why it’s here', 'Remote'])
    // The model's quotes are escaped for AppleScript, and there is no colour.
    expect(dialogs[0]).toContain('Here \\"git push --force\\" overwrites the branch.')
    expect(dialogs[0]).not.toContain('\x1b')
    expect(dialogs[0]).toContain('buttons {"Open in LensCode", "OK"}')
    expect(dialogs[0]).toContain('with icon caution')
  })

  it('opens LensCode when "Open in LensCode" is clicked', async () => {
    mockFetch({ lensCodeUp: true })
    const { launched } = await run(['--popup', 'ls'], {
      platform: 'darwin',
      dialogAnswer: 'button returned:Open in LensCode\n',
    })
    expect(launched).toEqual([['/usr/bin/open', 'http://localhost:5173/#explain=ls']])
  })

  it('does not open anything when OK is clicked', async () => {
    mockFetch()
    const { launched } = await run(['--popup', 'ls'], { platform: 'darwin' })
    expect(launched).toEqual([])
  })

  it('shows problems in the dialog too, since there may be no terminal', async () => {
    mockFetch()
    const noKey = await run(['--popup', 'ls'], { platform: 'darwin', env: {} })
    expect(noKey.code).toBe(1)
    expect(noKey.err).toBe('')
    expect(noKey.dialogs[0]).toContain('lens needs an AI key.')

    const nothing = await run(['--popup'], { platform: 'darwin', stdin: '  ' })
    expect(nothing.dialogs[0]).toContain('Nothing to explain. Highlight some text first.')
  })

  it('prints the message when the dialog cannot be shown', async () => {
    mockFetch()
    const { out } = await run(['--popup', 'ls'], { platform: 'darwin', dialogAnswer: null })
    expect(out).toContain('Force push')
  })

  it('prints in the terminal instead on other systems', async () => {
    mockFetch()
    const { code, out, err, dialogs } = await run(['--popup', 'ls'], { platform: 'linux' })
    expect(code).toBe(0)
    expect(dialogs).toEqual([])
    expect(out).toContain('Force push')
    expect(err).toContain('--popup needs macOS')
  })
})

describe('lens: other commands', () => {
  it('prints help, with the folder the key is read from', async () => {
    const { code, out } = await run(['--help'])
    expect(code).toBe(0)
    expect(out).toContain('Usage')
    expect(out).toContain(folder)
  })

  it('prints the version from package.json', async () => {
    const { out } = await run(['--version'])
    expect(out).toMatch(/^lens \d+\.\d+\.\d+\n$/)
  })

  it('prints setup instructions with the full paths of Node and the CLI', async () => {
    const script = join(folder, 'dist-cli', 'lens.mjs')
    expect((await run(['--setup-mac'])).out).toContain(`/usr/local/bin/node ${script} --popup`)
    expect((await run(['--setup-zsh'])).out).toContain(`| /usr/local/bin/node ${script}\n`)
  })

  it('explains a mistyped option', async () => {
    const { code, err } = await run(['--jsno', 'ls'])
    expect(code).toBe(1)
    expect(err).toContain('Unknown option --jsno.')
    expect(err).toContain('lens --help')
  })
})
