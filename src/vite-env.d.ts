/// <reference types="vite/client" />

/**
 * Client-side environment variables.
 *
 * Vite inlines every `VITE_`-prefixed variable into the bundle it ships to the
 * browser, so nothing secret may be declared here. API keys belong to the
 * backend — see `.env.example` and the README.
 */
interface ImportMetaEnv {
  /**
   * Path (or absolute URL) of the backend explanation route, e.g.
   * `/api/explain`. Unset means the app answers from the local mock catalog.
   * This is a location, not a credential.
   */
  readonly VITE_EXPLANATION_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
