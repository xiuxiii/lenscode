import { useEffect, useRef } from 'react'
import type { SavedWorkspace, SessionWriter } from '../lib/sessionStore'
import type { Explanation } from '../types/explanation'

/** Wait for a pause in typing before saving. */
const SAVE_DELAY_MS = 400

const NO_WORKSPACE: SavedWorkspace = { projectName: '', isExample: false, files: [], activeFileId: '' }

/**
 * Saves the workspace and explanation history to this browser whenever they
 * change, so a reload brings everything back.
 *
 * Workspace saves are debounced. When the page is hidden or unloaded, the
 * pending save is started and the latest typed text is written synchronously
 * as a draft (see `sessionStore`), so a refresh right after typing keeps the
 * last edit even if the browser abandons the asynchronous save.
 *
 * A `null` workspace means there is no session. When a session is closed
 * (it was there and now is not), the saved project is forgotten, so a reload
 * opens the start screen. Starting up without one writes nothing: if the
 * saved session is merely slow to read, it must survive.
 */
export function useSessionPersistence(
  writer: SessionWriter,
  workspace: SavedWorkspace | null,
  history: Explanation[],
) {
  const pending = useRef<SavedWorkspace | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hadSession = useRef(workspace !== null)
  // What was loaded is already saved; only a changed history needs writing.
  const loadedHistory = useRef(history)

  const hasSession = workspace !== null
  const { projectName, isExample, files, activeFileId } = workspace ?? NO_WORKSPACE

  useEffect(() => {
    if (!hasSession) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      pending.current = null
      if (hadSession.current) writer.clearWorkspace()
      hadSession.current = false
      return
    }
    hadSession.current = true

    const flush = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      if (pending.current) writer.saveWorkspace(pending.current)
      pending.current = null
    }
    const onLeave = () => {
      writer.persistDrafts()
      flush()
    }

    pending.current = { projectName, isExample, files, activeFileId }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)

    const onHide = () => {
      if (document.visibilityState === 'hidden') onLeave()
    }
    window.addEventListener('pagehide', onLeave)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [writer, hasSession, projectName, isExample, files, activeFileId])

  useEffect(() => {
    if (history !== loadedHistory.current) writer.saveHistory(history)
  }, [writer, history])
}
