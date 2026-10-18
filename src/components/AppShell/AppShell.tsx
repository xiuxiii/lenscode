import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useExplanation } from '../../hooks/useExplanation'
import { useSessionPersistence } from '../../hooks/useSessionPersistence'
import { useWorkspace } from '../../hooks/useWorkspace'
import { pickedFromDrop, readPickedFiles, type PickedFile } from '../../lib/importFiles'
import { createSessionWriter, type SavedSession } from '../../lib/sessionStore'
import { normalizeSelection } from '../../lib/selection'
import { EXPLAIN_SHORTCUT } from '../../lib/shortcuts'
import type { Explanation, ExplanationRequest } from '../../types/explanation'
import type { CodeSelection } from '../../types/workspace'
import { CodeEditor } from '../CodeEditor/CodeEditor'
import { EditorToolbar } from '../CodeEditor/EditorToolbar'
import { ExplanationPanel } from '../ExplanationPanel/ExplanationPanel'
import { FileSidebar, type ImportNotice } from '../FileSidebar/FileSidebar'
import { SparkleIcon } from '../icons'
import { TopBar } from '../TopBar/TopBar'
import './AppShell.css'

const PANEL_MIN = 340
const PANEL_MAX = 680
const PANEL_DEFAULT = 420
const PANEL_STEP = 16
const SIDEBAR_BREAKPOINT = 1180
/** At or below this width the sidebar is a drawer and the panel a bottom sheet. */
const MOBILE_QUERY = '(max-width: 768px)'
/** The mobile sheet's height, as a percentage of the space below the top bar. */
const SHEET_MIN = 45
const SHEET_MAX = 85
const SHEET_STEP = 5

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function initialSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true
  return window.innerWidth > SIDEBAR_BREAKPOINT
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

export function AppShell({ session }: { session: SavedSession }) {
  const workspace = useWorkspace(session.workspace)
  const { activeFile } = workspace
  const {
    state: explanationState,
    explain,
    retry,
    reset,
    show,
    clearHistory,
  } = useExplanation(session.history)

  // Remember the project and history in this browser across reloads.
  const [writer] = useState(() => createSessionWriter(session))
  useSessionPersistence(
    writer,
    {
      projectName: workspace.projectName,
      isExample: workspace.isExample,
      files: workspace.files,
      activeFileId: workspace.activeFileId,
    },
    explanationState.history,
  )

  const isMobile = useIsMobile()
  const [selection, setSelection] = useState<CodeSelection | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen)
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT)
  const [sheetPercent, setSheetPercent] = useState(SHEET_MIN)
  const resizing = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  /** On mobile the sidebar is a drawer: close it once it has done its job. */
  const closeDrawer = useCallback(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  // ─────────────────────────── Explain actions ───────────────────────────
  // The single request shape the explanation service accepts. `projectContext`
  // is intentionally left unset until project-level context exists.
  const buildRequest = useCallback(
    (code: string, range: CodeSelection | null): ExplanationRequest => ({
      selectedCode: code,
      language: activeFile.language,
      fileName: activeFile.path,
      surroundingContext: {
        fullSource: activeFile.content,
        range: range
          ? {
              startLine: range.startLine,
              startColumn: range.startColumn,
              endLine: range.endLine,
              endColumn: range.endColumn,
            }
          : null,
      },
    }),
    [activeFile],
  )

  const explainSelection = useCallback(() => {
    if (!selection || !selection.text.trim()) return
    void explain(buildRequest(selection.text, selection))
  }, [selection, explain, buildRequest])

  const explainConcept = useCallback(
    (label: string) => {
      void explain(buildRequest(label, null))
    },
    [explain, buildRequest],
  )

  // History holds full explanations, so reopening one costs no API call.
  const reopenExplanation = useCallback(
    (item: Explanation) => {
      show(item)
      closeDrawer()
    },
    [show, closeDrawer],
  )

  // ─────────────────────────── Workspace actions ───────────────────────────
  const selectFile = useCallback(
    (id: string) => {
      closeDrawer()
      if (id === activeFile.id) return
      workspace.selectFile(id)
      setSelection(null)
      reset()
    },
    [activeFile.id, workspace, reset, closeDrawer],
  )

  const newFile = useCallback(() => {
    workspace.addFile()
    setSelection(null)
    reset()
    closeDrawer()
  }, [workspace, reset, closeDrawer])

  // ─────────────────────────── Opening files ───────────────────────────
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null)
  const [dragDepth, setDragDepth] = useState(0)

  const closeProject = useCallback(() => {
    workspace.closeProject()
    setSelection(null)
    setImportNotice(null)
    reset()
  }, [workspace, reset])

  const importPicked = useCallback(
    async (picked: PickedFile[], mode: 'folder' | 'files', ignoredFolders?: string[]) => {
      if (picked.length === 0 && !ignoredFolders?.length) return
      setImporting(true)
      try {
        const result = await readPickedFiles(picked, {
          asFolder: mode === 'folder',
          ignoredFolders,
        })
        if (result.files.length > 0) {
          if (mode === 'folder' && result.rootName) {
            workspace.openFolder(result.rootName, result.files)
          } else {
            workspace.addFiles(result.files)
          }
          setSelection(null)
          reset()
        }
        setImportNotice({ mode, result })
      } finally {
        setImporting(false)
      }
    },
    [workspace, reset],
  )

  const hasFiles = (e: ReactDragEvent) => e.dataTransfer.types.includes('Files')

  // Capture-phase handlers so dropped files never reach Monaco (which would
  // otherwise try to insert them as text). Plain text drags are left alone.
  const dropHandlers = {
    onDragEnterCapture: (e: ReactDragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragDepth((d) => d + 1)
    },
    onDragOverCapture: (e: ReactDragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeaveCapture: (e: ReactDragEvent) => {
      if (!hasFiles(e)) return
      setDragDepth((d) => Math.max(0, d - 1))
    },
    onDropCapture: (e: ReactDragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      setDragDepth(0)
      // Must run synchronously inside the event, before the browser clears it.
      void pickedFromDrop(e.dataTransfer).then(({ picked, ignoredFolders, singleFolder }) =>
        importPicked(picked, singleFolder ? 'folder' : 'files', ignoredFolders),
      )
    },
  }

  // Collapse / restore the sidebar as the viewport crosses the breakpoint.
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SIDEBAR_BREAKPOINT}px)`)
    const onChange = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // ─────────────────────────── Panel resizing (desktop) ───────────────────────────
  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    resizing.current = true
    document.body.classList.add('is-resizing')
  }, [])

  const nudgePanel = useCallback((e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const delta = e.key === 'ArrowLeft' ? PANEL_STEP : -PANEL_STEP
    setPanelWidth((w) => clamp(w + delta, PANEL_MIN, PANEL_MAX))
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return
      setPanelWidth(clamp(window.innerWidth - e.clientX, PANEL_MIN, PANEL_MAX))
    }
    const onUp = () => {
      if (!resizing.current) return
      resizing.current = false
      document.body.classList.remove('is-resizing')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ─────────────────────────── Bottom sheet (mobile) ───────────────────────────
  const startSheetDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current
    if (!body) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const { bottom, height } = body.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      setSheetPercent(clamp(((bottom - ev.clientY) / height) * 100, SHEET_MIN, SHEET_MAX))
    }
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)
      document.body.classList.remove('is-resizing-sheet')
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
    document.body.classList.add('is-resizing-sheet')
  }, [])

  const nudgeSheet = useCallback((e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta = e.key === 'ArrowUp' ? SHEET_STEP : -SHEET_STEP
    setSheetPercent((p) => clamp(p + delta, SHEET_MIN, SHEET_MAX))
  }, [])

  const highlightRange =
    explanationState.status === 'loaded' || explanationState.status === 'loading'
      ? (explanationState.request?.surroundingContext.range ?? null)
      : null

  // The floating "Explain" pill is redundant while the current selection is
  // the thing already being explained.
  const selectionAlreadyExplained =
    Boolean(selection) &&
    explanationState.status !== 'idle' &&
    explanationState.status !== 'error' &&
    normalizeSelection(selection!.text) ===
      normalizeSelection(explanationState.request?.selectedCode ?? '')

  const hasSelection = Boolean(selection?.text.trim())

  const shellStyle = {
    '--panel-w': `${panelWidth}px`,
    '--sheet-h': `${sheetPercent}%`,
  } as CSSProperties

  return (
    <div
      className={`app-shell${sidebarOpen ? '' : ' app-shell--sidebar-collapsed'}`}
      style={shellStyle}
      {...dropHandlers}
    >
      <TopBar
        projectName={workspace.projectName}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="app-shell__body" ref={bodyRef}>
        {sidebarOpen && (
          <FileSidebar
            files={workspace.files}
            activeFile={activeFile}
            history={explanationState.history}
            importing={importing}
            notice={importNotice}
            onSelectFile={selectFile}
            onNewFile={newFile}
            onOpenFolder={(picked) => void importPicked(picked, 'folder')}
            onOpenFiles={(picked) => void importPicked(picked, 'files')}
            onDismissNotice={() => setImportNotice(null)}
            projectName={workspace.projectName}
            isExample={workspace.isExample}
            onCloseProject={closeProject}
            onReopenExplanation={reopenExplanation}
            onClearHistory={clearHistory}
          />
        )}
        {sidebarOpen && isMobile && (
          <div className="app-shell__scrim" onClick={() => setSidebarOpen(false)} />
        )}

        <section className="app-shell__editor" aria-label="Code editor">
          <EditorToolbar file={activeFile} canExplain={hasSelection} onExplain={explainSelection} />
          <CodeEditor
            file={activeFile}
            onChange={(content) => {
              // Recorded synchronously so a reload right after typing keeps it.
              writer.noteDraft(activeFile.id, content)
              workspace.setContent(content)
            }}
            onSelectionChange={setSelection}
            onExplain={explainSelection}
            highlightRange={highlightRange}
            suppressActions={selectionAlreadyExplained}
          />
          {isMobile && hasSelection && !selectionAlreadyExplained && (
            <button
              type="button"
              className="btn btn--primary app-shell__mobile-explain"
              onClick={explainSelection}
              title={`Explain the selection (${EXPLAIN_SHORTCUT})`}
            >
              <SparkleIcon size={16} />
              Explain
            </button>
          )}
        </section>

        <div
          className="app-shell__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize explanation panel"
          aria-valuenow={panelWidth}
          aria-valuemin={PANEL_MIN}
          aria-valuemax={PANEL_MAX}
          tabIndex={0}
          onMouseDown={startResize}
          onKeyDown={nudgePanel}
          onDoubleClick={() => setPanelWidth(PANEL_DEFAULT)}
        />

        <ExplanationPanel
          state={explanationState}
          selection={selection}
          language={activeFile.language}
          onExplainSelection={explainSelection}
          onExplainConcept={explainConcept}
          onRetry={retry}
          sheetHandle={
            isMobile ? (
              <div
                className="app-shell__sheet-handle"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize explanation panel"
                aria-valuenow={Math.round(sheetPercent)}
                aria-valuemin={SHEET_MIN}
                aria-valuemax={SHEET_MAX}
                tabIndex={0}
                onPointerDown={startSheetDrag}
                onKeyDown={nudgeSheet}
                onDoubleClick={() => setSheetPercent(SHEET_MIN)}
              />
            ) : null
          }
        />
      </div>

      {dragDepth > 0 && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay__card">
            <p className="drop-overlay__title">Drop to open</p>
            <p className="drop-overlay__hint">
              A folder opens as a project; files are added to this one. Nothing is
              uploaded.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
