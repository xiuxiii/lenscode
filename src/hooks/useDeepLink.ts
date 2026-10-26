import { useEffect, useRef, useState } from 'react'
import { readExplainHash } from '../lib/deepLink'
import { wholeRange } from '../lib/selection'
import type { ExplanationRequest } from '../types/explanation'
import type { WorkspaceFile } from '../types/workspace'

/**
 * Opening LensCode at `#explain=<text>` (as `lens --open` does) explains
 * that text. It is added to the open session as a new file, or starts a
 * session when there is none, and all of it is explained straight away. The
 * hash is then removed, so a reload does not do it again.
 *
 * Links are handled once the saved session has loaded, and again whenever
 * the hash changes while the app is open.
 */

interface DeepLinkOptions {
  /** The saved session's read, while it is still running (`SavedSession.late`). */
  late: Promise<unknown> | null
  /** Whether a session is open; the text is added to it, never replaces it. */
  hasSession: boolean
  addSnippet: (text: string, newSession: boolean) => WorkspaceFile
  /** Shows the workspace after the session changed. */
  enterSession: () => void
  explain: (request: ExplanationRequest) => Promise<void>
}

export function useDeepLink(options: DeepLinkOptions) {
  // The latest values, read when a link arrives rather than when it was set up.
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  // A slow saved session is waited for, so the text joins it rather than an
  // empty stand-in that would then be saved over it.
  const { late } = options
  const [ready, setReady] = useState(late === null)
  useEffect(() => {
    if (!late) return
    let current = true
    void late.then(() => {
      if (current) setReady(true)
    })
    return () => {
      current = false
    }
  }, [late])

  useEffect(() => {
    if (!ready) return
    const openLink = () => {
      const text = readExplainHash(window.location.hash)
      if (text === null) return
      const { pathname, search } = window.location
      window.history.replaceState(window.history.state, '', pathname + search)

      const { hasSession, addSnippet, enterSession, explain } = latest.current
      const file = addSnippet(text, !hasSession)
      enterSession()
      void explain({
        selectedCode: file.content,
        language: file.language,
        fileName: file.path,
        surroundingContext: { fullSource: file.content, range: wholeRange(file.content) },
      })
    }
    // On a timer, so React's development-only second run of effects (which
    // cancels explanations in flight) is over before this one starts.
    const timer = setTimeout(openLink)
    window.addEventListener('hashchange', openLink)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('hashchange', openLink)
    }
  }, [ready])
}
