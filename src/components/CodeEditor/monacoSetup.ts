import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
// Monaco's package "exports" map serves `monaco-editor/<path>` from `esm/vs/<path>.js`.
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

export const LENS_THEME = 'lenscode-dark'

/** Must match `--font-mono` in index.css (Monaco can't read CSS variables). */
export const EDITOR_FONT_FAMILY =
  "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

/**
 * The editor palette. Neutral surfaces and text mirror the tokens in
 * index.css; syntax uses at most four hues, each at least 4.5:1 on BG.
 */
const BG = '#0a0a0a' // --bg
const RAISED = '#1a1a1a' // --bg-raised
const TEXT = '#ededed' // --text: identifiers (16.9:1)
const TEXT_2 = '#a1a1a1' // --text-2: punctuation, operators (7.7:1)
const COMMENT = '#7d7d7d' // 4.8:1, upright (no faux italic)
const LINE_NUMBER = '#5e5e5e'
const KEYWORD = '#c4a1ff' // 9.3:1
const STRING = '#8fd4a6' // 11.4:1
const TYPE = '#79b8ff' // 9.5:1: types, tags, keys, properties
const NUMBER = '#f2b46d' // 10.9:1: numbers, constants, CSS values
const ACCENT = '#0070f3' // --accent
const SELECTION = '#0070f34d' // --selection (30%)
const BORDER = '#ffffff14' // --border (8%)
const BORDER_STRONG = '#ffffff25' // --border-strong (14.5%)
const ACTIVE = '#ffffff10' // --bg-active (6%)

/** Theme rules take colours without the leading '#'. */
const fg = (color: string) => color.slice(1)

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

  // Bracket-pair colorisation is a *text model* option in standalone Monaco:
  // the editor's `bracketPairColorization` option never reaches models made
  // with createModel (which @monaco-editor/react uses), and the model service
  // re-applies its default (on) whenever the editor configuration changes —
  // including when an editor is created. So each model switches it off on
  // creation and again whenever anything turns it back on.
  monaco.editor.onDidCreateModel((model) => {
    const keepOff = () => {
      if (!model.getOptions().bracketPairColorizationOptions.enabled) return
      model.updateOptions({
        bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
      })
    }
    keepOff()
    model.onDidChangeOptions(keepOff)
  })

  monaco.editor.defineTheme(LENS_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: fg(TEXT) },
      { token: 'comment', foreground: fg(COMMENT) },
      { token: 'keyword', foreground: fg(KEYWORD) },
      { token: 'keyword.json', foreground: fg(KEYWORD) },
      { token: 'storage', foreground: fg(KEYWORD) },
      { token: 'type', foreground: fg(TYPE) },
      { token: 'type.identifier', foreground: fg(TYPE) },
      { token: 'predefined', foreground: fg(TYPE) },
      { token: 'identifier', foreground: fg(TEXT) },
      { token: 'variable', foreground: fg(TYPE) },
      { token: 'string', foreground: fg(STRING) },
      { token: 'string.key.json', foreground: fg(TYPE) },
      { token: 'string.value.json', foreground: fg(STRING) },
      { token: 'regexp', foreground: fg(STRING) },
      { token: 'number', foreground: fg(NUMBER) },
      { token: 'constant', foreground: fg(NUMBER) },
      { token: 'delimiter', foreground: fg(TEXT_2) },
      { token: 'delimiter.bracket', foreground: fg(TEXT_2) },
      { token: 'delimiter.parenthesis', foreground: fg(TEXT_2) },
      { token: 'delimiter.square', foreground: fg(TEXT_2) },
      { token: 'delimiter.html', foreground: fg(TEXT_2) },
      { token: 'operator', foreground: fg(TEXT_2) },
      { token: 'tag', foreground: fg(TYPE) },
      { token: 'metatag', foreground: fg(KEYWORD) },
      { token: 'annotation', foreground: fg(KEYWORD) },
      { token: 'attribute.name', foreground: fg(KEYWORD) },
      { token: 'attribute.value', foreground: fg(STRING) },
      { token: 'attribute.value.html', foreground: fg(STRING) },
      { token: 'attribute.name.css', foreground: fg(TYPE) },
      { token: 'attribute.value.css', foreground: fg(NUMBER) },
      { token: 'attribute.value.number.css', foreground: fg(NUMBER) },
      { token: 'attribute.value.unit.css', foreground: fg(NUMBER) },
      { token: 'attribute.value.hex.css', foreground: fg(NUMBER) },
      { token: 'tag.css', foreground: fg(KEYWORD) },
    ],
    colors: {
      'editor.background': BG,
      'editor.foreground': TEXT,
      'editorLineNumber.foreground': LINE_NUMBER,
      'editorLineNumber.activeForeground': TEXT_2,
      'editorCursor.foreground': ACCENT,
      'editor.selectionBackground': SELECTION,
      'editor.inactiveSelectionBackground': '#0070f326',
      'editor.selectionHighlightBackground': '#00000000',
      'editor.lineHighlightBackground': '#ffffff06',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': BORDER,
      'editorIndentGuide.activeBackground1': BORDER_STRONG,
      'editorBracketMatch.background': ACTIVE,
      'editorBracketMatch.border': BORDER_STRONG,
      // Backstop: even if colorisation turns on, brackets stay punctuation-grey.
      'editorBracketHighlight.foreground1': TEXT_2,
      'editorBracketHighlight.foreground2': TEXT_2,
      'editorBracketHighlight.foreground3': TEXT_2,
      'editorBracketHighlight.foreground4': TEXT_2,
      'editorBracketHighlight.foreground5': TEXT_2,
      'editorBracketHighlight.foreground6': TEXT_2,
      'editorBracketHighlight.unexpectedBracket.foreground': TEXT_2,
      'editorWidget.background': RAISED,
      'editorWidget.border': BORDER_STRONG,
      'editorSuggestWidget.background': RAISED,
      'editorSuggestWidget.border': BORDER_STRONG,
      'editorSuggestWidget.selectedBackground': ACTIVE,
      'editorHoverWidget.background': RAISED,
      'editorHoverWidget.border': BORDER_STRONG,
      'scrollbarSlider.background': '#ffffff1a',
      'scrollbarSlider.hoverBackground': '#ffffff26',
      'scrollbarSlider.activeBackground': '#ffffff33',
      'editorGutter.background': BG,
      'editor.findMatchBackground': '#0070f366',
      'editor.findMatchHighlightBackground': '#0070f326',
      'minimap.background': BG,
      'menu.background': RAISED,
      'menu.foreground': TEXT,
      'menu.selectionBackground': ACTIVE,
      'menu.selectionForeground': TEXT,
      'menu.border': BORDER_STRONG,
      'menu.separatorBackground': BORDER,
      'focusBorder': ACCENT,
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

  // Self-hosted fonts load on first use, which can be after Monaco measured
  // its glyphs: load the editor faces explicitly, then remeasure.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    Promise.all([
      document.fonts.load("400 13px 'Geist Mono'"),
      document.fonts.load("600 13px 'Geist Mono'"),
    ])
      .then(() => monaco.editor.remeasureFonts())
      .catch(() => {})
  }
}

export { monaco }
