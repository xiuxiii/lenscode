import { execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { main } from './main.ts'

/**
 * Entry point of the `lens` command: `npm run build:cli` bundles it into
 * dist-cli/lens.mjs. See `main.ts` for what it does.
 */

/** Far more than the 8,000 characters one explanation can take. */
const MAX_STDIN_BYTES = 1_000_000

async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
    size += (chunk as Buffer).length
    if (size > MAX_STDIN_BYTES) break
  }
  return Buffer.concat(chunks).toString('utf8')
}

function launch(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
      // Windows: hand `start ""` its arguments exactly as written.
      windowsVerbatimArguments: process.platform === 'win32',
    })
    child.once('error', () => resolve(false))
    child.once('spawn', () => {
      child.unref()
      resolve(true)
    })
  })
}

function capture(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, (error, stdout) => resolve(error ? null : stdout))
  })
}

process.exitCode = await main({
  argv: process.argv.slice(2),
  env: process.env,
  readStdin,
  stdout: { write: (text) => process.stdout.write(text), isTTY: Boolean(process.stdout.isTTY) },
  stderr: { write: (text) => process.stderr.write(text), isTTY: Boolean(process.stderr.isTTY) },
  platform: process.platform,
  scriptPath: fileURLToPath(import.meta.url),
  nodePath: process.execPath,
  launch,
  capture,
})
