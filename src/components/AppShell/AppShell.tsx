import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { DEFAULT_PROJECT_NAME } from '../../data/starterFiles'
import { useExplanation } from '../../hooks/useExplanation'
import { useWorkspace } from '../../hooks/useWorkspace'
import { normalizeSelection } from '../../lib/selection'
import type { Explanation, ExplanationRequest } from '../../types/explanation'
import type { CodeSelection } from '../../types/workspace'
import { CodeEditor, type CursorPosition } from '../CodeEditor/CodeEditor'
import { EditorToolbar } from '../CodeEditor/EditorToolbar'
import { ExplanationPanel } from '../ExplanationPanel/ExplanationPanel'
import { FileSidebar } from '../FileSidebar/FileSidebar'
import { StatusBar } from '../StatusBar/StatusBar'
import { TopBar } from '../TopBar/TopBar'
import './AppShell.css'

const PANEL_MIN = 340
const PANEL_MAX = 680
const PANEL_DEFAULT = 420
const SIDEBAR_BREAKPOINT = 1180

function initialSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true
  return window.innerWidth > SIDEBAR_BREAKPOINT
}

export function AppShell() {
  const workspace = useWorkspace()
  const { activeFile } = workspace
  const { state: explanationState, explain, retry, reset, providerName } =
    useExplanation()

  const [selection, setSelection] = useState<CodeSelection | null>(null)
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 })
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen)
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT)
  const resizing = useRef(false)

  // ─────────────────────────── Explain actions ───────────────────────────
  // The single request shape the explanation service accepts. `projectContext`
  // is intentionally left unset until project-level context exists.
  const buildRequest = useCallback(
    (code: string, range: CodeSelection | null): ExplanationRequest => ({
      selectedCode: code,
      language: activeFile.language,
      fileName: activeFile.name,
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

  const reopenExplanation = useCallback(
    (item: Explanation) => {
      void explain({
        selectedCode: item.selectedCode,
        language: item.language,
        fileName: activeFile.name,
        surroundingContext: { fullSource: activeFile.content, range: null },
      })
    },
    [explain, activeFile],
  )

  // ─────────────────────────── Workspace actions ───────────────────────────
  const selectFile = useCallback(
    (id: string) => {
      if (id === activeFile.id) return
      workspace.selectFile(id)
      setSelection(null)
      reset()
    },
    [activeFile.id, workspace, reset],
  )

  const newFile = useCallback(() => {
    workspace.addFile()
    setSelection(null)
    reset()
  }, [workspace, reset])

  // Collapse / restore the sidebar as the viewport crosses the breakpoint.
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SIDEBAR_BREAKPOINT}px)`)
    const onChange = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // ─────────────────────────── Panel resizing ───────────────────────────
  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    resizing.current = true
    document.body.classList.add('is-resizing')
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const next = window.innerWidth - e.clientX
      setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, next)))
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

  return (
    <div
      className={`app-shell${sidebarOpen ? '' : ' app-shell--sidebar-collapsed'}`}
      style={{ '--panel-w': `${panelWidth}px` } as CSSProperties}
    >
      <TopBar
        projectName={DEFAULT_PROJECT_NAME}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="app-shell__body">
        {sidebarOpen && (
          <FileSidebar
            projectName={DEFAULT_PROJECT_NAME}
            files={workspace.files}
            activeFileId={activeFile.id}
            history={explanationState.history}
            onSelectFile={selectFile}
            onNewFile={newFile}
            onReopenExplanation={reopenExplanation}
          />
        )}

        <section className="app-shell__editor" aria-label="Code editor">
          <EditorToolbar
            file={activeFile}
            selection={selection}
            onExplain={explainSelection}
          />
          <CodeEditor
            file={activeFile}
            onChange={workspace.setContent}
            onSelectionChange={setSelection}
            onCursorChange={setCursor}
            onExplain={explainSelection}
            highlightRange={highlightRange}
            suppressActions={selectionAlreadyExplained}
          />
        </section>

        <div
          className="app-shell__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize explanation panel"
          onMouseDown={startResize}
          onDoubleClick={() => setPanelWidth(PANEL_DEFAULT)}
        />

        <ExplanationPanel
          state={explanationState}
          selection={selection}
          language={activeFile.language}
          onExplainSelection={explainSelection}
          onExplainConcept={explainConcept}
          onRetry={retry}
        />
      </div>

      <StatusBar
        fileName={activeFile.name}
        language={activeFile.language}
        cursor={cursor}
        selection={selection}
        explanationStatus={explanationState.status}
        providerName={providerName}
      />
    </div>
  )
}
