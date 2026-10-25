import { describe, expect, it } from 'vitest'
import { DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL, readLlmConfig } from './config.ts'

describe('readLlmConfig', () => {
  it('is null without a key', () => {
    expect(readLlmConfig({})).toBeNull()
    expect(readLlmConfig({ LLM_API_KEY: '   ' })).toBeNull()
  })

  it('defaults to DeepSeek with only a key', () => {
    expect(readLlmConfig({ LLM_API_KEY: 'sk-test' })).toEqual({
      apiKey: 'sk-test',
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      timeoutMs: 40_000,
      dailyLimit: 0,
    })
  })

  it('trims values and trailing slashes from the base URL', () => {
    const config = readLlmConfig({
      LLM_API_KEY: '  sk-test  ',
      LLM_BASE_URL: ' http://localhost:11434/v1/// ',
      LLM_MODEL: ' llama3 ',
    })
    expect(config).toMatchObject({
      apiKey: 'sk-test',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3',
    })
  })

  it('reads a positive timeout and ignores an invalid one', () => {
    expect(readLlmConfig({ LLM_API_KEY: 'k', LLM_TIMEOUT_MS: '5000' })?.timeoutMs).toBe(5000)
    expect(readLlmConfig({ LLM_API_KEY: 'k', LLM_TIMEOUT_MS: 'soon' })?.timeoutMs).toBe(40_000)
    expect(readLlmConfig({ LLM_API_KEY: 'k', LLM_TIMEOUT_MS: '-1' })?.timeoutMs).toBe(40_000)
  })

  it('reads a daily limit, where unset, 0 or invalid means no limit', () => {
    const limit = (value?: string) => readLlmConfig({ LLM_API_KEY: 'k', LLM_DAILY_LIMIT: value })?.dailyLimit
    expect(limit('500')).toBe(500)
    expect(limit(' 20 ')).toBe(20)
    expect(limit('2.9')).toBe(2)
    expect(limit(undefined)).toBe(0)
    expect(limit('')).toBe(0)
    expect(limit('0')).toBe(0)
    expect(limit('-3')).toBe(0)
    expect(limit('lots')).toBe(0)
  })

  it('falls back to defaults for blank optional values', () => {
    const config = readLlmConfig({ LLM_API_KEY: 'k', LLM_BASE_URL: ' ', LLM_MODEL: '' })
    expect(config?.baseUrl).toBe(DEFAULT_LLM_BASE_URL)
    expect(config?.model).toBe(DEFAULT_LLM_MODEL)
  })
})
