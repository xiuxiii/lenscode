import { readLlmConfig } from '../server/explain/config.ts'
import { createFollowUpHandler } from '../server/explain/handler.ts'

/** Vercel Function for `POST /api/followup`. See `api/explain.ts`. */
const handle = createFollowUpHandler({
  config: readLlmConfig(process.env),
  log: (message) => console.warn(message),
})

export const POST = (request: Request) => handle(request)
