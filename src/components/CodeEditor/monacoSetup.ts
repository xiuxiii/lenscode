import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
// Monaco's package "exports" map serves `monaco-editor/<path>` from `esm/vs/<path>.js`.
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

export const LENS_THEME = 'lenscode-dark'

let configured = false

/**
 * Bundle Monaco locally (no CDN), register web workers, define the editor
 * theme and relax diagnostics so pasted fragments do not light up with
 * semantic errors that would distract a beginner.
 */
export function configureMonaco(): void {
  if (configured) return
  configured = true

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      switch (label) {
        case 'json':
          return new jsonWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker()
        case 'typescript':
        case 'javascript':
          return new tsWorker()
        default:
          return new editorWorker()
      }
    },
  }

  loader.config({ monaco })

  monaco.editor.defineTheme(LENS_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'd7dce4' },
      { token: 'comment', foreground: '5d6774', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'keyword.json', foreground: '7c9cff' },
      { token: 'storage', foreground: 'c792ea' },
      { token: 'type', foreground: '7fd1e6' },
      { token: 'type.identifier', foreground: '7fd1e6' },
      { token: 'identifier', foreground: 'd7dce4' },
      { token: 'string', foreground: '9ad19d' },
      { token: 'string.key.json', foreground: '7c9cff' },
      { token: 'string.value.json', foreground: '9ad19d' },
      { token: 'number', foreground: 'f2b56b' },
      { token: 'delimiter', foreground: '8b94a3' },
      { token: 'delimiter.bracket', foreground: '8b94a3' },
      { token: 'tag', foreground: '7c9cff' },
      { token: 'metatag', foreground: '7c9cff' },
      { token: 'attribute.name', foreground: 'c792ea' },
      { token: 'attribute.value', foreground: '9ad19d' },
      { token: 'attribute.value.html', foreground: '9ad19d' },
      { token: 'attribute.name.css', foreground: '7fd1e6' },
      { token: 'attribute.value.css', foreground: 'f2b56b' },
      { token: 'attribute.value.number.css', foreground: 'f2b56b' },
      { token: 'attribute.value.unit.css', foreground: 'f2b56b' },
      { token: 'attribute.value.hex.css', foreground: 'f2b56b' },
      { token: 'tag.css', foreground: 'f6c177' },
      { token: 'variable', foreground: '7fd1e6' },
      { token: 'operator', foreground: '8b94a3' },
    ],
    colors: {
      'editor.background': '#0e1116',
      'editor.foreground': '#d7dce4',
      'editorLineNumber.foreground': '#3a4250',
      'editorLineNumber.activeForeground': '#7c8594',
      'editorCursor.foreground': '#7c9cff',
      'editor.selectionBackground': '#7c9cff4d',
      'editor.inactiveSelectionBackground': '#7c9cff2a',
      'editor.selectionHighlightBackground': '#00000000',
      'editor.lineHighlightBackground': '#ffffff06',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#1e232b',
      'editorIndentGuide.activeBackground1': '#2f3742',
      'editorBracketMatch.background': '#7c9cff26',
      'editorBracketMatch.border': '#7c9cff66',
      'editorWidget.background': '#171b22',
      'editorWidget.border': '#2a3039',
      'editorSuggestWidget.background': '#171b22',
      'editorSuggestWidget.border': '#2a3039',
      'editorSuggestWidget.selectedBackground': '#1f2836',
      'editorHoverWidget.background': '#171b22',
      'editorHoverWidget.border': '#2a3039',
      'scrollbarSlider.background': '#2a303980',
      'scrollbarSlider.hoverBackground': '#2a3039c0',
      'scrollbarSlider.activeBackground': '#3a4250',
      'editorGutter.background': '#0e1116',
      'editor.findMatchBackground': '#f2b56b55',
      'editor.findMatchHighlightBackground': '#f2b56b2a',
      'minimap.background': '#0e1116',
      'menu.background': '#171b22',
      'menu.foreground': '#d7dce4',
      'menu.selectionBackground': '#1f2836',
      'menu.border': '#2a3039',
      'menu.separatorBackground': '#2a3039',
      'focusBorder': '#7c9cff66',
    },
  })

  const diagnostics = {
    noSemanticValidation: true,
    noSyntaxValidation: false,
  }
  monaco.typescript.javascriptDefaults.setDiagnosticsOptions(diagnostics)
  monaco.typescript.typescriptDefaults.setDiagnosticsOptions(diagnostics)
  monaco.typescript.javascriptDefaults.setCompilerOptions({
    allowJs: true,
    allowNonTsExtensions: true,
    target: monaco.typescript.ScriptTarget.ESNext,
  })

  // Web fonts can finish loading after the editor measured its glyphs.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    document.fonts.ready.then(() => monaco.editor.remeasureFonts()).catch(() => {})
  }
}

export { monaco }
