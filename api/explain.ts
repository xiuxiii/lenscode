import { readLlmConfig } from '../server/explain/config.ts'
import { createExplainHandler } from '../server/explain/handler.ts'

/**
 * Vercel Function for `POST /api/explain`. Same handler as the Vite dev
 * server's (see `server/vitePlugin.ts`); `LLM_API_KEY` comes from the
 * project's environment variables on Vercel.
 */
const handle = createExplainHandler({
  config: readLlmConfig(process.env),
  log: (message) => console.warn(message),
})

export const POST = (request: Request) => handle(request)
