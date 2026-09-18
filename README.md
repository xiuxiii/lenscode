# LensCode

**Google Lens for code.** Paste code, highlight any part of it, and get a plain-language explanation of exactly what you are looking at.

This is the first segment of the product: a polished, fully interactive frontend with a mock explanation engine. There is no backend, database, auth, or LLM call yet. The architecture is set up so a real API can replace the mock without touching the UI.

## Core flow

```
PASTE CODE → SELECT CODE → EXPLAIN → READ EXPLANATION
```

1. The app opens directly into the workspace with a realistic starter file.
2. Highlight a keyword, a name, a call, or a whole line in the editor.
3. A small **Explain** pill appears next to the selection. Click it, press `⌘E` / `Ctrl+E`, use the editor context menu, or click the persistent **Explain** button in the toolbar.
4. The explanation panel on the right shows what it is, the technical definition, what it does in this code, why it is here, and related concepts to learn next.
5. Click a related concept to explain that next. The sidebar keeps a short history of what you have explained.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run lint
```

Node 20+ is recommended.

## Stack

- React 19 + TypeScript, built with Vite
- Monaco Editor (bundled locally, no CDN), with web workers for JS/TS, HTML, CSS and JSON
- Plain CSS with design tokens; no UI framework

## Project structure

```
src/
  components/
    AppShell/           Layout grid, workspace + explanation state wiring, panel resizer
    TopBar/             Brand, project switcher placeholder, settings
    FileSidebar/        Starter files, "new file", recent explanations
    CodeEditor/         Monaco wrapper, selection tracking, floating action, theme + workers
      EditorToolbar     File name, language selector, persistent Explain button
    LanguageSelector/
    SelectionActions/   Floating "Explain" pill + shared ExplainButton
    ExplanationPanel/   All panel states (empty, selected, loading, loaded, error) + "Ask about this"
      ExplanationSection, RelatedConcepts
    StatusBar/          Engine, status, cursor, selection, language, file
  hooks/
    useExplanation.ts   Reducer-based state machine (idle → loading → loaded | error) with cancellation
    useWorkspace.ts     In-memory files and active file
  services/
    explanationService.ts   ExplanationProvider contract + the local mock provider
  data/
    mockExplanations.ts     Curated explanation catalog (JS/TS, Python, HTML, CSS, JSON)
    starterFiles.ts         Files that open by default
    languages.ts            Supported languages
  types/
    explanation.ts          Explanation, ExplanationRequest, ExplanationProvider
    workspace.ts            WorkspaceFile, CodeSelection, LanguageId
```

## Swapping in a real backend

Everything the UI renders comes from an `Explanation` object:

```ts
{
  id, selectedCode, language, concept, kind,
  simpleExplanation,      // WHAT IS IT?
  definition,             // TECHNICAL DEFINITION
  contextualExplanation,  // IN THIS CODE
  whyItExists,            // WHY IS IT HERE?
  relatedConcepts,        // RELATED CONCEPTS
}
```

The UI asks for one through the `ExplanationProvider` interface in `src/types/explanation.ts`:

```ts
interface ExplanationProvider {
  readonly name: string
  explain(request: ExplanationRequest, signal?: AbortSignal): Promise<Explanation>
}
```

`ExplanationRequest` carries the selected code, the language, the full source, the selection range and the file name, which is everything an LLM-backed endpoint needs for a contextual answer. To go live, implement the interface with an HTTP client and change the single `explanationProvider` export in `src/services/explanationService.ts`. The mock provider simulates latency and fails for unknown selections so the loading and error states can be demonstrated.

## Interaction states covered

| State | What the panel shows |
| --- | --- |
| No selection | "Select some code to inspect it." with a short hint |
| Selected, not explained | The selected code and a large **Explain this** button |
| Loading | Skeleton sections, no spinner |
| Loaded | The full explanation, plus clickable related concepts |
| Error | A clear message, a suggestion, and **Retry** |
| Explained, then new selection | A slim "New selection" strip on top of the current explanation |

While an explanation is open, the explained range stays subtly underlined in the editor so the code and the panel stay visibly linked.
