import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { configureMonaco, LENS_THEME, monaco } from './monacoSetup'
import { SelectionActions, type PopoverPosition } from '../SelectionActions/SelectionActions'
import type { SourceRange } from '../../types/explanation'
import type { CodeSelection, WorkspaceFile } from '../../types/workspace'
import './CodeEditor.css'

configureMonaco()

export interface CursorPosition {
  line: number
  column: number
}

interface CodeEditorProps {
  file: WorkspaceFile
  onChange: (content: string) => void
  onSelectionChange: (selection: CodeSelection | null) => void
  onCursorChange: (position: CursorPosition) => void
  /** Fired by the floating action, the keyboard shortcut or the context menu. */
  onExplain: () => void
  /** Range of the code currently shown in the explanation panel. */
  highlightRange: SourceRange | null
  /** Hide the floating action, e.g. when the selection is already explained. */
  suppressActions?: boolean
}

type IStandaloneCodeEditor = MonacoEditor.IStandaloneCodeEditor

const POPOVER_WIDTH = 132
const POPOVER_HEIGHT = 30
const POPOVER_GAP = 6

const EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  fontSize: 13.5,
  lineHeight: 22,
  fontLigatures: false,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  padding: { top: 18, bottom: 24 },
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  roundedSelection: true,
  lineNumbersMinChars: 3,
  glyphMargin: false,
  folding: true,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
  },
  selectionHighlight: false,
  occurrencesHighlight: 'off',
  renderWhitespace: 'none',
  guides: { indentation: true, bracketPairs: false },
  bracketPairColorization: { enabled: false },
  tabSize: 2,
  wordWrap: 'off',
  // Beginners re-highlighting code should never accidentally move it.
  dragAndDrop: false,
  automaticLayout: true,
  contextmenu: true,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
  hover: { enabled: 'off' },
  codeLens: false,
  links: false,
  matchBrackets: 'always',
  stickyScroll: { enabled: false },
  'semanticHighlighting.enabled': false,
}

function EditorLoading() {
  return (
    <div className="code-editor__loading" aria-hidden>
      <div className="code-editor__loading-line" style={{ width: '38%' }} />
      <div className="code-editor__loading-line" style={{ width: '62%' }} />
      <div className="code-editor__loading-line" style={{ width: '48%' }} />
      <div className="code-editor__loading-line" style={{ width: '30%' }} />
    </div>
  )
}

export function CodeEditor({
  file,
  onChange,
  onSelectionChange,
  onCursorChange,
  onExplain,
  highlightRange,
  suppressActions = false,
}: CodeEditorProps) {
  const editorRef = useRef<IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const draggingRef = useRef(false)
  const focusedRef = useRef(false)
  const [popover, setPopover] = useState<PopoverPosition | null>(null)

  // Keep latest callbacks reachable from listeners registered once on mount.
  const callbacks = useRef({ onSelectionChange, onCursorChange, onExplain })
  useEffect(() => {
    callbacks.current = { onSelectionChange, onCursorChange, onExplain }
  })

  const updatePopover = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const selection = editor.getSelection()
    const dom = editor.getDomNode()
    if (!selection || selection.isEmpty() || draggingRef.current || !dom || !focusedRef.current) {
      setPopover(null)
      return
    }
    const singleLine = selection.startLineNumber === selection.endLineNumber
    const anchor = {
      lineNumber: selection.endLineNumber,
      column: singleLine ? selection.getPosition().column : selection.endColumn,
    }
    const pos = editor.getScrolledVisiblePosition(anchor)
    if (!pos) {
      setPopover(null)
      return
    }
    const { width, height } = dom.getBoundingClientRect()
    if (pos.top < 0 || pos.top + pos.height > height) {
      setPopover(null)
      return
    }
    const layout = editor.getLayoutInfo()
    const minLeft = layout.contentLeft + 2
    let left = Math.max(minLeft, pos.left)
    left = Math.min(left, width - POPOVER_WIDTH - 12)
    let top = pos.top + pos.height + POPOVER_GAP
    let placement: PopoverPosition['placement'] = 'below'
    if (top + POPOVER_HEIGHT > height - 8) {
      top = pos.top - POPOVER_HEIGHT - POPOVER_GAP
      placement = 'above'
    }
    setPopover({ top, left, placement })
  }, [])

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    decorationsRef.current = editor.createDecorationsCollection()

    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel()
      const sel = e.selection
      if (!model || sel.isEmpty()) {
        callbacks.current.onSelectionChange(null)
      } else {
        callbacks.current.onSelectionChange({
          text: model.getValueInRange(sel),
          startLine: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLine: sel.endLineNumber,
          endColumn: sel.endColumn,
        })
      }
      updatePopover()
    })

    editor.onDidChangeCursorPosition((e) => {
      callbacks.current.onCursorChange({
        line: e.position.lineNumber,
        column: e.position.column,
      })
    })

    editor.onDidScrollChange(updatePopover)
    editor.onDidLayoutChange(updatePopover)

    editor.onMouseDown(() => {
      draggingRef.current = true
      setPopover(null)
    })
    editor.onDidFocusEditorWidget(() => {
      focusedRef.current = true
      updatePopover()
    })
    editor.onDidBlurEditorWidget(() => {
      focusedRef.current = false
      setPopover(null)
    })

    editor.addAction({
      id: 'lenscode.explainSelection',
      label: 'Explain selection',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE],
      precondition: 'editorHasSelection',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 0,
      run: () => callbacks.current.onExplain(),
    })

    const position = editor.getPosition()
    if (position) {
      callbacks.current.onCursorChange({
        line: position.lineNumber,
        column: position.column,
      })
    }
  }

  // Mouse-up can happen outside the editor; listen globally.
  useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      // Let Monaco finalise the selection first.
      requestAnimationFrame(updatePopover)
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [updatePopover])

  // Highlight the range that is currently explained.
  useEffect(() => {
    const collection = decorationsRef.current
    if (!collection) return
    if (!highlightRange) {
      collection.clear()
      return
    }
    collection.set([
      {
        range: new monaco.Range(
          highlightRange.startLine,
          highlightRange.startColumn,
          highlightRange.endLine,
          highlightRange.endColumn,
        ),
        options: {
          className: 'lens-explained-range',
          linesDecorationsClassName: 'lens-explained-gutter',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ])
  }, [highlightRange, file.id])

  const handleExplainClick = () => {
    callbacks.current.onExplain()
    editorRef.current?.focus()
  }

  return (
    <div className="code-editor">
      <Editor
        // Monaco caches one model per path. File ids are never reused, so a
        // newly opened folder can't inherit a stale model from an old file
        // that happened to have the same path (e.g. two package.json files).
        path={file.id}
        language={file.language}
        value={file.content}
        theme={LENS_THEME}
        options={EDITOR_OPTIONS}
        // A switched-to file starts with no selection, matching the reset panel.
        saveViewState={false}
        loading={<EditorLoading />}
        onMount={handleMount}
        onChange={(value) => onChange(value ?? '')}
      />
      <SelectionActions
        position={suppressActions ? null : popover}
        onExplain={handleExplainClick}
      />
    </div>
  )
}
