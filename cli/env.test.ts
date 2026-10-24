import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadEnv, parseDotEnv } from './env'

describe('parseDotEnv', () => {
  it('reads KEY=value lines', () => {
    expect(parseDotEnv('LLM_API_KEY=sk-123\nLLM_MODEL=deepseek-chat\n')).toEqual({
      LLM_API_KEY: 'sk-123',
      LLM_MODEL: 'deepseek-chat',
    })
  })

  it('skips comments, blank lines and lines without =', () => {
    const text = '# Setup\n\n# LLM_BASE_URL=https://api.deepseek.com\nnot a setting\nLLM_API_KEY=k\n'
    expect(parseDotEnv(text)).toEqual({ LLM_API_KEY: 'k' })
  })

  it('keeps an empty value, as in .env.example', () => {
    expect(parseDotEnv('LLM_API_KEY=\n')).toEqual({ LLM_API_KEY: '' })
  })

  it('trims spaces around the key, the = and a bare value', () => {
    expect(parseDotEnv('  LLM_MODEL =  llama3  \n')).toEqual({ LLM_MODEL: 'llama3' })
  })

  it('accepts an export prefix and Windows line endings', () => {
    expect(parseDotEnv('export LLM_API_KEY=k\r\nLLM_MODEL=m\r\n')).toEqual({ LLM_API_KEY: 'k', LLM_MODEL: 'm' })
  })

  it('ends a bare value at #, like dotenv', () => {
    expect(parseDotEnv('LLM_TIMEOUT_MS=5000 # five seconds\n')).toEqual({ LLM_TIMEOUT_MS: '5000' })
  })

  it('takes quoted values as written, comments after them aside', () => {
    expect(parseDotEnv(`A="sk # not a comment" # comment\nB='single'\nC=\`x\`\n`)).toEqual({
      A: 'sk # not a comment',
      B: 'single',
      C: 'x',
    })
    expect(parseDotEnv('A=" spaced "\n')).toEqual({ A: ' spaced ' })
  })

  it('expands \\n only inside double quotes', () => {
    expect(parseDotEnv(`A="one\\ntwo"\nB='one\\ntwo'\n`)).toEqual({ A: 'one\ntwo', B: 'one\\ntwo' })
  })

  it('treats an unclosed quote as part of a bare value', () => {
    expect(parseDotEnv('A="abc\n')).toEqual({ A: '"abc' })
  })

  it('lets a later line win', () => {
    expect(parseDotEnv('A=1\nA=2\n')).toEqual({ A: '2' })
  })
})

describe('loadEnv', () => {
  let folder: string
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'lens-env-'))
  })
  afterEach(() => {
    rmSync(folder, { recursive: true, force: true })
  })

  it('prefers the shell, then .env.local, then .env', () => {
    writeFileSync(join(folder, '.env'), 'A=env\nB=env\nC=env\n')
    writeFileSync(join(folder, '.env.local'), 'A=local\nB=local\n')
    expect(loadEnv(folder, { A: 'shell' })).toMatchObject({ A: 'shell', B: 'local', C: 'env' })
  })

  it('lets a file fill in a variable the shell leaves undefined', () => {
    writeFileSync(join(folder, '.env.local'), 'LLM_API_KEY=from-file\n')
    expect(loadEnv(folder, { LLM_API_KEY: undefined })).toEqual({ LLM_API_KEY: 'from-file' })
  })

  it('works without any .env file', () => {
    expect(loadEnv(folder, { LLM_API_KEY: 'k' })).toEqual({ LLM_API_KEY: 'k' })
  })
})
