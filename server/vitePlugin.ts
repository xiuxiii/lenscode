import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Connect, type Plugin } from 'vite'
import { readLlmConfig } from './explain/config.ts'
import { createExplainHandler } from './explain/handler.ts'

/**
 * Serves `POST /api/explain` from the Vite dev server (`npm run dev`) and the
 * preview server (`npm run preview`).
 *
 * The LLM key is read here, in Node, via `loadEnv(mode, root, '')`. It is
 * never `define`d, so it cannot reach the browser bundle.
 */

export const EXPLAIN_ROUTE = '/api/explain'
const MAX_BODY_BYTES = 1_000_000

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        resolve(null)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function createMiddleware(handle: (request: Request) => Promise<Response>) {
  const middleware: Connect.NextHandleFunction = (req, res) => {
    void (async () => {
      // Abort the upstream LLM call if the browser goes away (new selection).
      const controller = new AbortController()
      res.on('close', () => {
        if (!res.writableEnded) controller.abort()
      })

      const method = req.method ?? 'GET'
      const body = method === 'POST' ? await readBody(req) : undefined
      if (body === null) {
        sendJson(res, 413, {
          error: { code: 'unknown', message: 'The request is too large to explain.' },
        })
        return
      }

      const response = await handle(
        new Request(`http://localhost${EXPLAIN_ROUTE}`, {
          method,
          headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
          body: body ? new Uint8Array(body) : undefined,
          signal: controller.signal,
        }),
      )
      if (res.writableEnded || res.destroyed) return
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(await response.text())
    })().catch((err: unknown) => {
      console.error('[explain] middleware error:', err)
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: { code: 'server_error', message: 'Something went wrong on the server.' },
        })
      }
    })
  }
  return middleware
}

export function explainApi(): Plugin {
  let middleware: Connect.NextHandleFunction | null = null

  return {
    name: 'lenscode-explain-api',

    config(userConfig, { mode }) {
      const root = userConfig.root ?? process.cwd()
      const envDir = typeof userConfig.envDir === 'string' ? userConfig.envDir : root
      // '' prefix: load every variable, including the server-only LLM_* ones.
      const env = loadEnv(mode, envDir, '')

      const handle = createExplainHandler({
        config: readLlmConfig(env),
        log: (message) => console.warn(message),
      })
      middleware = createMiddleware(handle)
    },

    configureServer(server) {
      if (middleware) server.middlewares.use(EXPLAIN_ROUTE, middleware)
    },

    configurePreviewServer(server) {
      if (middleware) server.middlewares.use(EXPLAIN_ROUTE, middleware)
    },
  }
}
