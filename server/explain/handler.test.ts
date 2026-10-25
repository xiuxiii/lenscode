import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Explanation } from '../../src/types/explanation.ts'
import type { LlmConfig } from './config.ts'
import { createExplainHandler, createFollowUpHandler } from './handler.ts'

const CONFIG: LlmConfig = {
  apiKey: 'sk-test',
  baseUrl: 'https://llm.example',
  model: 'test-model',
  timeoutMs: 5_000,
}

const VALID_REQUEST = {
  selectedCode: 'await',
  language: 'javascript',
  fileName: 'a.js',
  surroundingContext: {
    fullSource: 'const r = await fetch(url)',
    range: { startLine: 1, startColumn: 11, endLine: 1, endColumn: 16 },
  },
}

const ANSWER = {
  title: 'Await keyword',
  kind: 'keyword',
  whatIsIt: 'It waits.',
  technicalDefinition: 'Pauses until a promise settles.',
  inThisCode: 'Waits for fetch.',
  whyItsHere: 'So r is the response.',
  relatedConcepts: [{ name: 'Promise', explanation: 'a later value' }],
}

/** An OpenAI-style chat completion whose message is `content`. */
function completion(content: string, finishReason = 'stop') {
  return new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function mockProvider(response: Response | (() => Response | Promise<Response>)) {
  const fetchMock = vi.fn(async () => (typeof response === 'function' ? response() : response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function post(body: unknown, init: RequestInit = {}) {
  return new Request('http://localhost/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })
}

async function errorOf(response: Response) {
  const body = (await response.json()) as { error: { code: string; message: string } }
  return { status: response.status, ...body.error }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/explain: request handling', () => {
  const handle = createExplainHandler({ config: CONFIG })

  it('rejects other methods', async () => {
    const res = await handle(new Request('http://localhost/api/explain'))
    expect(res.status).toBe(405)
  })

  it('answers not_configured without a key, before reading the body', async () => {
    const res = await createExplainHandler({ config: null })(post('not json'))
    expect(await errorOf(res)).toMatchObject({ status: 503, code: 'not_configured' })
  })

  it('rejects a body that is not JSON', async () => {
    const res = await handle(post('{oops'))
    expect(await errorOf(res)).toMatchObject({ status: 400, message: 'The request body is not valid JSON.' })
  })

  it.each([
    ['a non-object body', 42, 'Expected a JSON object.'],
    ['an empty selection', { ...VALID_REQUEST, selectedCode: '  ' }, 'selectedCode must be a non-empty string.'],
    ['a selection over 8,000 characters', { ...VALID_REQUEST, selectedCode: 'x'.repeat(8_001) }, 'The selection is too long'],
    ['an unknown language', { ...VALID_REQUEST, language: 'cobol' }, 'language is not a supported language id.'],
    ['missing source', { ...VALID_REQUEST, surroundingContext: {} }, 'surroundingContext.fullSource must be a string.'],
    [
      'an oversized file',
      { ...VALID_REQUEST, surroundingContext: { fullSource: 'x'.repeat(500_001), range: null } },
      'The file is too large',
    ],
    [
      'a malformed range',
      { ...VALID_REQUEST, surroundingContext: { fullSource: 'x', range: { startLine: 0, startColumn: 1, endLine: 1, endColumn: 1 } } },
      'surroundingContext.range must be null or four positive integers.',
    ],
    ['a non-string file name', { ...VALID_REQUEST, fileName: 7 }, 'fileName must be a string when present.'],
  ])('rejects %s with a 400', async (_name, body, message) => {
    const fetchMock = mockProvider(completion(JSON.stringify(ANSWER)))
    const res = await handle(post(body))
    const error = await errorOf(res)
    expect(error.status).toBe(400)
    expect(error.message).toContain(message)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/explain: talking to the model', () => {
  const log = vi.fn()
  // A fresh handler each time, so no answer comes from an earlier test's cache.
  let handle: ReturnType<typeof createExplainHandler>
  beforeEach(() => {
    handle = createExplainHandler({ config: CONFIG, log })
  })

  afterEach(() => log.mockReset())

  it('returns a validated explanation', async () => {
    mockProvider(completion(JSON.stringify(ANSWER)))
    const res = await handle(post(VALID_REQUEST))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body).toMatchObject({
      selectedCode: 'await',
      language: 'javascript',
      concept: 'Await keyword',
      simpleExplanation: 'It waits.',
      relatedConcepts: [{ label: 'Promise', hint: 'a later value' }],
    })
  })

  it('calls the configured provider with the key, model and JSON mode', async () => {
    const fetchMock = mockProvider(completion(JSON.stringify(ANSWER)))
    await handle(post(VALID_REQUEST))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://llm.example/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    const sent = JSON.parse(init.body as string)
    expect(sent.model).toBe('test-model')
    expect(sent.response_format).toEqual({ type: 'json_object' })
    expect(sent.messages[1].content).toContain('<<<SELECTION\nawait\nSELECTION>>>')
  })

  it('accepts an answer wrapped in a code fence or prose', async () => {
    mockProvider(completion('Sure! ```json\n' + JSON.stringify(ANSWER) + '\n``` Hope that helps.'))
    const res = await handle(post(VALID_REQUEST))
    expect(res.status).toBe(200)
  })

  it('reports an answer with no JSON as invalid_response', async () => {
    mockProvider(completion('I cannot help with that.'))
    const res = await handle(post(VALID_REQUEST))
    expect(await errorOf(res)).toMatchObject({ status: 502, code: 'invalid_response' })
    expect(log).toHaveBeenCalled()
  })

  it('reports an incomplete explanation as invalid_response', async () => {
    const { inThisCode: _omitted, ...incomplete } = ANSWER
    mockProvider(completion(JSON.stringify(incomplete)))
    const res = await handle(post(VALID_REQUEST))
    expect(await errorOf(res)).toMatchObject({ status: 502, code: 'invalid_response' })
  })

  it('reports an empty answer', async () => {
    mockProvider(completion('   '))
    const res = await handle(post(VALID_REQUEST))
    expect(await errorOf(res)).toMatchObject({ status: 502, code: 'invalid_response', message: 'The model returned an empty answer. Try again.' })
  })

  it('reports an answer cut off by the token limit', async () => {
    mockProvider(completion('{"title": "Aw', 'length'))
    const res = await handle(post(VALID_REQUEST))
    const error = await errorOf(res)
    expect(error).toMatchObject({ status: 502, code: 'invalid_response' })
    expect(error.message).toContain('cut off')
  })

  it('reports a provider response that is not JSON', async () => {
    mockProvider(new Response('<html>Bad gateway</html>', { status: 200 }))
    const res = await handle(post(VALID_REQUEST))
    expect(await errorOf(res)).toMatchObject({ status: 502, code: 'invalid_response' })
  })

  it.each([
    [401, 502, 'server_error', 'rejected the API key'],
    [403, 502, 'server_error', 'rejected the API key'],
    [402, 502, 'server_error', 'out of credit'],
    [404, 502, 'server_error', 'Check LLM_MODEL'],
    [429, 429, 'rate_limited', 'rate-limiting'],
    [500, 503, 'server_error', 'unavailable right now (HTTP 500)'],
  ])('maps provider HTTP %i to %i %s', async (upstream, status, code, message) => {
    mockProvider(new Response(JSON.stringify({ error: { message: 'detail' } }), { status: upstream }))
    const res = await handle(post(VALID_REQUEST))
    const error = await errorOf(res)
    expect(error).toMatchObject({ status, code })
    expect(error.message).toContain(message)
  })

  it('includes the provider detail for a rejected model', async () => {
    mockProvider(new Response(JSON.stringify({ error: { message: 'Model Not Exist' } }), { status: 400 }))
    const res = await handle(post(VALID_REQUEST))
    expect((await errorOf(res)).message).toContain('(Model Not Exist)')
  })

  it('never puts the API key in an error message or the log', async () => {
    mockProvider(new Response('{}', { status: 401 }))
    const res = await handle(post(VALID_REQUEST))
    expect(await res.text()).not.toContain('sk-test')
    expect(JSON.stringify(log.mock.calls)).not.toContain('sk-test')
  })

  it('reports an unreachable provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') })
    }))
    const res = await handle(post(VALID_REQUEST))
    const error = await errorOf(res)
    expect(error).toMatchObject({ status: 502, code: 'server_error' })
    expect(error.message).toContain('Could not reach the LLM provider at https://llm.example (ECONNREFUSED)')
  })

  it('reports a cancelled request as aborted, without logging it', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      controller.abort()
      init.signal?.throwIfAborted()
      return completion(JSON.stringify(ANSWER))
    }))
    const res = await handle(post(VALID_REQUEST, { signal: controller.signal }))
    expect(await errorOf(res)).toMatchObject({ status: 499, code: 'aborted' })
    expect(log).not.toHaveBeenCalled()
  })

  it('reports the provider taking too long', async () => {
    const handleFast = createExplainHandler({ config: { ...CONFIG, timeoutMs: 20 } })
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
    ))
    const res = await handleFast(post(VALID_REQUEST))
    expect(await errorOf(res)).toMatchObject({ status: 504, code: 'timeout' })
  })
})

const FOLLOW_UP = {
  request: VALID_REQUEST,
  explanation: {
    concept: 'Await keyword',
    simpleExplanation: 'It waits.',
    definition: 'Pauses until a promise settles.',
    contextualExplanation: 'Waits for fetch.',
    whyItExists: 'So r is the response.',
  },
  previous: [],
  question: 'Why not use .then()?',
}

/** A provider that answers every call, valid both as an explanation and as a follow-up answer. */
function answeringProvider() {
  return mockProvider(() => completion(JSON.stringify({ ...ANSWER, answer: 'Because.' })))
}

/** The valid request, about different code. */
const requestFor = (selectedCode: string) => ({ ...VALID_REQUEST, selectedCode })

const explanationOf = async (response: Response) => (await response.json()) as Explanation

describe('POST /api/explain: repeat explanations', () => {
  afterEach(() => vi.useRealTimers())

  it('answers a repeat from memory, with a fresh id', async () => {
    const handle = createExplainHandler({ config: CONFIG })
    const fetchMock = answeringProvider()
    const first = await explanationOf(await handle(post(VALID_REQUEST)))
    const res = await handle(post(VALID_REQUEST))
    expect(res.status).toBe(200)
    const second = await explanationOf(res)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual({ ...first, id: second.id })
    expect(second.id).not.toBe(first.id)
  })

  it('asks the model again when the code around the selection changes', async () => {
    const handle = createExplainHandler({ config: CONFIG })
    const fetchMock = answeringProvider()
    const { surroundingContext } = VALID_REQUEST
    await handle(post(VALID_REQUEST))
    await handle(post({ ...VALID_REQUEST, surroundingContext: { ...surroundingContext, fullSource: 'const r = await fetch(api)' } }))
    await handle(post({ ...VALID_REQUEST, fileName: 'b.js' }))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not keep failures', async () => {
    const handle = createExplainHandler({ config: CONFIG })
    const replies = [
      new Response('{}', { status: 500 }),
      completion('I cannot help with that.'),
      completion(JSON.stringify(ANSWER)),
    ]
    let call = 0
    const fetchMock = mockProvider(() => replies[call++])
    expect((await handle(post(VALID_REQUEST))).status).toBe(503)
    expect((await handle(post(VALID_REQUEST))).status).toBe(502)
    expect((await handle(post(VALID_REQUEST))).status).toBe(200)
    expect((await handle(post(VALID_REQUEST))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shares an answer across hidden secrets, but echoes each request’s own code', async () => {
    const handle = createExplainHandler({ config: CONFIG })
    const fetchMock = answeringProvider()
    const withKey = (key: string) => ({
      ...VALID_REQUEST,
      selectedCode: `const key = "${key}"`,
      surroundingContext: {
        fullSource: `const key = "${key}"`,
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 42 },
      },
    })
    await handle(post(withKey('sk-proj-aaa111bbb222ccc333ddd')))
    const second = await explanationOf(await handle(post(withKey('sk-proj-eee444fff555ggg666hhh'))))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.selectedCode).toBe('const key = "sk-proj-eee444fff555ggg666hhh"')
  })

  it('forgets an answer after an hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const handle = createExplainHandler({ config: CONFIG })
    const fetchMock = answeringProvider()
    await handle(post(VALID_REQUEST))
    vi.setSystemTime(Date.now() + 59 * 60_000)
    await handle(post(VALID_REQUEST))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 2 * 60_000)
    await handle(post(VALID_REQUEST))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the 200 most recently used answers', async () => {
    const handle = createExplainHandler({ config: CONFIG })
    const fetchMock = answeringProvider()
    for (let i = 0; i <= 200; i++) await handle(post(requestFor(`step${i}()`)))
    expect(fetchMock).toHaveBeenCalledTimes(201)
    await handle(post(requestFor('step200()')))
    expect(fetchMock).toHaveBeenCalledTimes(201)
    await handle(post(requestFor('step0()')))
    expect(fetchMock).toHaveBeenCalledTimes(202)
  })

  it('does not cache follow-up answers', async () => {
    const handle = createFollowUpHandler({ config: CONFIG })
    const fetchMock = answeringProvider()
    for (let i = 0; i < 2; i++) {
      expect(await (await handle(post(FOLLOW_UP))).json()).toEqual({ answer: 'Because.' })
    }
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('LLM_DAILY_LIMIT', () => {
  const limited = (dailyLimit: number): LlmConfig => ({ ...CONFIG, dailyLimit })

  afterEach(() => vi.useRealTimers())

  it('refuses AI calls over the limit with a 429 that says why', async () => {
    const handle = createExplainHandler({ config: limited(2) })
    const fetchMock = answeringProvider()
    expect((await handle(post(requestFor('a')))).status).toBe(200)
    expect((await handle(post(requestFor('b')))).status).toBe(200)
    expect(await errorOf(await handle(post(requestFor('c'))))).toEqual({
      status: 429,
      code: 'rate_limited',
      message:
        "LensCode's daily limit of 2 AI requests is used up (LLM_DAILY_LIMIT). It resets at midnight.",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('answers repeats from the cache without counting them', async () => {
    const handle = createExplainHandler({ config: limited(1) })
    const fetchMock = answeringProvider()
    for (let i = 0; i < 3; i++) expect((await handle(post(VALID_REQUEST))).status).toBe(200)
    expect((await errorOf(await handle(post(requestFor('other'))))).message).toBe(
      "LensCode's daily limit of 1 AI request is used up (LLM_DAILY_LIMIT). It resets at midnight.",
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('counts follow-ups, in one count with explanations from the same config', async () => {
    const config = limited(2)
    const explain = createExplainHandler({ config })
    const followUp = createFollowUpHandler({ config })
    const fetchMock = answeringProvider()
    expect((await explain(post(VALID_REQUEST))).status).toBe(200)
    expect((await followUp(post(FOLLOW_UP))).status).toBe(200)
    expect(await errorOf(await followUp(post(FOLLOW_UP)))).toMatchObject({ status: 429, code: 'rate_limited' })
    expect((await explain(post(requestFor('other')))).status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not count requests turned away before reaching the AI', async () => {
    const handle = createExplainHandler({ config: limited(1) })
    answeringProvider()
    expect((await handle(post({ ...VALID_REQUEST, language: 'cobol' }))).status).toBe(400)
    expect((await handle(post(VALID_REQUEST))).status).toBe(200)
  })

  it('starts again at midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 24, 23, 58))
    const handle = createExplainHandler({ config: limited(1) })
    answeringProvider()
    expect((await handle(post(requestFor('a')))).status).toBe(200)
    expect((await handle(post(requestFor('b')))).status).toBe(429)
    vi.setSystemTime(new Date(2026, 9, 25, 0, 1))
    expect((await handle(post(requestFor('b')))).status).toBe(200)
  })

  it('has no limit when it is 0 or unset', async () => {
    const fetchMock = answeringProvider()
    for (const config of [limited(0), CONFIG]) {
      const handle = createExplainHandler({ config })
      for (const code of ['a', 'b', 'c']) expect((await handle(post(requestFor(code)))).status).toBe(200)
    }
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})
