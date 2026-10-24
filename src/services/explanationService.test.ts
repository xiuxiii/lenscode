import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExplanationError, type ExplanationRequest } from '../types/explanation'
import { explainCode } from './explanationService'

const REQUEST: ExplanationRequest = {
  selectedCode: 'await',
  language: 'javascript',
  fileName: 'a.js',
  surroundingContext: { fullSource: 'await f()', range: null },
}

const EXPLANATION = {
  concept: 'Await keyword',
  kind: 'keyword',
  simpleExplanation: 'It waits.',
  definition: 'Pauses until a promise settles.',
  contextualExplanation: 'Waits for f.',
  whyItExists: 'To get the result.',
  relatedConcepts: [{ label: 'Promise' }],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function failureOf(promise: Promise<unknown>): Promise<ExplanationError> {
  try {
    await promise
  } catch (err) {
    expect(err).toBeInstanceOf(ExplanationError)
    return err as ExplanationError
  }
  throw new Error('expected the call to fail')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('explainCode', () => {
  it('POSTs the request as JSON to /api/explain and returns the explanation', async () => {
    const fetchMock = mockFetch(async () => json(EXPLANATION))
    const result = await explainCode(REQUEST)
    expect(result).toMatchObject({ concept: 'Await keyword', selectedCode: 'await' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/explain')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it("prefers the server's own error message and code", async () => {
    mockFetch(async () =>
      json({ error: { code: 'not_configured', message: 'No LLM_API_KEY is configured.' } }, 503),
    )
    const error = await failureOf(explainCode(REQUEST))
    expect(error.code).toBe('not_configured')
    expect(error.message).toBe('No LLM_API_KEY is configured.')
  })

  it('treats an unknown server error code as unknown, keeping the message', async () => {
    mockFetch(async () => json({ error: { code: 'teapot', message: 'Short and stout.' } }, 418))
    const error = await failureOf(explainCode(REQUEST))
    expect(error.code).toBe('unknown')
    expect(error.message).toBe('Short and stout.')
  })

  it.each([
    [404, 'server_error', 'route was not found'],
    [429, 'rate_limited', 'Too many explanations'],
    [500, 'server_error', 'unavailable right now'],
    [400, 'unknown', 'rejected the request (400)'],
  ])('maps a bare HTTP %i to %s', async (status, code, message) => {
    mockFetch(async () => new Response('not json', { status }))
    const error = await failureOf(explainCode(REQUEST))
    expect(error.code).toBe(code)
    expect(error.message).toContain(message)
  })

  it('reports an unreadable success body', async () => {
    mockFetch(async () => new Response('<html>', { status: 200 }))
    expect((await failureOf(explainCode(REQUEST))).code).toBe('invalid_response')
  })

  it('reports an incomplete explanation', async () => {
    mockFetch(async () => json({ concept: 'x' }))
    expect((await failureOf(explainCode(REQUEST))).code).toBe('invalid_response')
  })

  it('reports a network failure', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect((await failureOf(explainCode(REQUEST))).code).toBe('network')
  })

  it('reports a cancelled request as aborted', async () => {
    const controller = new AbortController()
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const pending = explainCode(REQUEST, { signal: controller.signal })
    controller.abort()
    expect((await failureOf(pending)).code).toBe('aborted')
  })

  it('gives up after 45 seconds', async () => {
    vi.useFakeTimers()
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const pending = failureOf(explainCode(REQUEST))
    await vi.advanceTimersByTimeAsync(45_000)
    expect((await pending).code).toBe('timeout')
  })
})
