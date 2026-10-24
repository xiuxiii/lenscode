import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { configureMonaco, EDITOR_FONT_FAMILY, LENS_THEME, monaco } from './monacoSetup'
import { SelectionActions, type PopoverPosition } from '../SelectionActions/SelectionActions'
import type { SourceRange } from '../../types/explanation'
import type { CodeSelection, WorkspaceFile } from '../../types/workspace'
import './CodeEditor.css'

configureMonaco()

interface CodeEditorProps {
  file: WorkspaceFile
  onChange: (content: string) => void
  onSelectionChange: (selection: CodeSelection | null) => void
  /** Fired by the floating action, the keyboard shortcut or the context menu. */
  onExplain: () => void
  /** A selection made with the mouse, fired once the button is released. */
  onSelectEnd: (selection: CodeSelection) => void
  /** Range of the code currently shown in the explanation panel. */
  highlightRange: SourceRange | null
  /** Hide the floating action, e.g. when the selection is already explained. */
  suppressActions?: boolean
}

type IStandaloneCodeEditor = MonacoEditor.IStandaloneCodeEditor

/** The editor's current selection, or null when nothing is selected. */
function readSelection(editor: IStandaloneCodeEditor): CodeSelection | null {
  const model = editor.getModel()
  const sel = editor.getSelection()
  if (!model || !sel || sel.isEmpty()) return null
  return {
    text: model.getValueInRange(sel),
    startLine: sel.startLineNumber,
    startColumn: sel.startColumn,
    endLine: sel.endLineNumber,
    endColumn: sel.endColumn,
  }
}

/** The floating Explain pill's footprint, for placing it clear of the selection. */
const PILL_WIDTH = 88
const PILL_HEIGHT = 28
const PILL_GAP = 4

const EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  fontFamily: EDITOR_FONT_FAMILY,
  fontSize: 13,
  lineHeight: 20,
  fontLigatures: false,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  padding: { top: 16, bottom: 24 },
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  roundedSelection: false,
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
  // Not enough on its own; see the model-level switch in monacoSetup.
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
  // The last line's number in full colour on every platform (Linux dims it).
  renderFinalNewline: 'on',
  ariaLabel: 'Code editor. Press Escape, then Tab, to move out of the editor.',
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
  onExplain,
  onSelectEnd,
  highlightRange,
  suppressActions = false,
}: CodeEditorProps) {
  const editorRef = useRef<IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const draggingRef = useRef(false)
  /** The current drag is a left-button selection (not a right-click for the menu). */
  const selectingRef = useRef(false)
  /** The pending after-release check; a newer press or release replaces it. */
  const releaseFrame = useRef(0)
  const focusedRef = useRef(false)
  const [popover, setPopover] = useState<PopoverPosition | null>(null)
  /** Show how to leave the editor, for someone who arrived by keyboard. */
  const [keyboardHint, setKeyboardHint] = useState(false)
  const lastInputWasKeyboard = useRef(false)
  /** Where the code starts, so the empty-file hint lines up with the caret. */
  const [contentLeft, setContentLeft] = useState<number | null>(null)

  // Keep latest callbacks reachable from listeners registered once on mount.
  const callbacks = useRef({ onSelectionChange, onExplain, onSelectEnd })
  useEffect(() => {
    callbacks.current = { onSelectionChange, onExplain, onSelectEnd }
  })

  /**
   * Place the Explain pill where it never covers the selection: above the
   * first selected line; else just past the end of the selected lines; else
   * below the last one. Hidden when none of those is visible.
   */
  const updatePopover = useCallback(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    const dom = editor?.getDomNode()
    const selection = editor?.getSelection()
    if (
      !editor ||
      !model ||
      !dom ||
      !selection ||
      selection.isEmpty() ||
      draggingRef.current ||
      !focusedRef.current
    ) {
      setPopover(null)
      return
    }
    const { width, height } = dom.getBoundingClientRect()
    const layout = editor.getLayoutInfo()
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
    const right = width - layout.verticalScrollbarWidth - 8
    const visible = (top: number) => top >= 0 && top + lineHeight <= height
    const clampLeft = (left: number) =>
      Math.max(layout.contentLeft, Math.min(left, right - PILL_WIDTH))
    const at = (lineNumber: number, column: number) =>
      editor.getScrolledVisiblePosition({ lineNumber, column })

    const { startLineNumber, startColumn, endLineNumber, endColumn } = selection
    const start = at(startLineNumber, startColumn)
    if (start && visible(start.top) && start.top - PILL_GAP - PILL_HEIGHT >= 0) {
      setPopover({ top: start.top - PILL_GAP - PILL_HEIGHT, left: clampLeft(start.left) })
      return
    }

    // Right of the longest selected line, so the pill can't overlap any of it.
    let lineEnd = -1
    for (let line = startLineNumber; line <= endLineNumber; line++) {
      const pos = at(line, model.getLineMaxColumn(line))
      if (pos && visible(pos.top)) lineEnd = Math.max(lineEnd, pos.left)
    }
    const last = at(endLineNumber, endColumn)
    if (last && visible(last.top) && lineEnd >= 0 && lineEnd + 8 + PILL_WIDTH <= right) {
      setPopover({ top: last.top + (lineHeight - PILL_HEIGHT) / 2, left: lineEnd + 8 })
      return
    }

    if (last && visible(last.top) && last.top + lineHeight + PILL_GAP + PILL_HEIGHT <= height) {
      setPopover({
        top: last.top + lineHeight + PILL_GAP,
        left: clampLeft(start?.left ?? last.left),
      })
      return
    }
    setPopover(null)
  }, [])

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    decorationsRef.current = editor.createDecorationsCollection()

    editor.onDidChangeCursorSelection(() => {
      callbacks.current.onSelectionChange(readSelection(editor))
      updatePopover()
    })

    editor.onDidScrollChange(updatePopover)
    editor.onDidLayoutChange((layout) => {
      setContentLeft(layout.contentLeft)
      updatePopover()
    })
    setContentLeft(editor.getLayoutInfo().contentLeft)
    // An empty file is there to be pasted into: be ready for it.
    if (!editor.getValue()) editor.focus()

    editor.onMouseDown((e) => {
      cancelAnimationFrame(releaseFrame.current)
      draggingRef.current = true
      selectingRef.current = e.event.leftButton
      setPopover(null)
    })
    editor.onDidFocusEditorWidget(() => {
      focusedRef.current = true
      if (lastInputWasKeyboard.current) setKeyboardHint(true)
      updatePopover()
    })
    editor.onDidBlurEditorWidget(() => {
      focusedRef.current = false
      setPopover(null)
      setKeyboardHint(false)
      editor.updateOptions({ tabFocusMode: false })
    })

    // Tab indents, as in any editor, so it can't also move focus out. Escape
    // first, then Tab (or Shift+Tab), moves on: Monaco's tab-focus mode is
    // switched on by Escape and off again by any other key.
    const MODIFIERS = [
      monaco.KeyCode.Shift,
      monaco.KeyCode.Ctrl,
      monaco.KeyCode.Alt,
      monaco.KeyCode.Meta,
      monaco.KeyCode.Tab,
    ]
    editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Escape) editor.updateOptions({ tabFocusMode: true })
      else if (!MODIFIERS.includes(e.keyCode)) editor.updateOptions({ tabFocusMode: false })
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
  }

  // Whether focus is arriving by keyboard (Tab) or by pointer (a click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') lastInputWasKeyboard.current = true
    }
    const onPointer = () => {
      lastInputWasKeyboard.current = false
      setKeyboardHint(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])

  // Mouse-up can happen outside the editor; listen globally. Letting go of a
  // mouse selection (a drag, a double-click, a click on a line number) is
  // what asks for its explanation.
  useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      const selecting = selectingRef.current
      selectingRef.current = false
      // Let Monaco finalise the selection first. Only the last release of a
      // quick double-click gets here.
      cancelAnimationFrame(releaseFrame.current)
      releaseFrame.current = requestAnimationFrame(() => {
        updatePopover()
        const editor = editorRef.current
        const selection = editor && selecting ? readSelection(editor) : null
        if (selection) callbacks.current.onSelectEnd(selection)
      })
    }
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mouseup', onUp)
      cancelAnimationFrame(releaseFrame.current)
    }
  }, [updatePopover])

  // Same for a blank file opened while the editor is already showing.
  const isBlank = file.content === ''
  useEffect(() => {
    if (isBlank) editorRef.current?.focus()
  }, [file.id, isBlank])

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
      {isBlank && contentLeft !== null && (
        <p className="code-editor__placeholder" style={{ left: contentLeft }} aria-hidden="true">
          Paste or type code here, then highlight any part of it to have it explained.
        </p>
      )}
      {keyboardHint && (
        <p className="code-editor__keyboard-hint" aria-hidden="true">
          <kbd className="kbd">Esc</kbd> then <kbd className="kbd">Tab</kbd> to leave the editor
        </p>
      )}
      <SelectionActions
        position={suppressActions ? null : popover}
        onExplain={handleExplainClick}
      />
    </div>
  )
}
