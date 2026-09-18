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
    explanationService.ts       explainCode() — the only door between UI and AI
    explanationProviders/
      mockProvider.ts           Local catalog lookup (active today)
      httpProvider.ts           Backend client (inactive until configured)
  data/
    mockExplanations.ts     Curated explanation catalog (JS/TS, Python, HTML, CSS, JSON)
    starterFiles.ts         Files that open by default
    languages.ts            Supported languages
  types/
    explanation.ts          Explanation, ExplanationRequest, ExplanationProvider
    workspace.ts            WorkspaceFile, CodeSelection, LanguageId
```

## AI API Integration

*Written for the next developer picking this up. Nothing in this repository calls an LLM yet; everything below is the seam prepared for one.*

### Where the boundary is

`src/services/explanationService.ts` is the only door between the UI and whatever produces explanations. It exports one function:

```ts
const explanation = await explainCode(request, { signal })
```

The UI calls it through `useExplanation()` and nowhere else. It does **not** know which provider answers, whether HTTP is involved, what endpoint is hit, how auth works, which model runs, or how the prompt is built. Keep it that way: everything provider-specific stays behind this module.

```
Code selection (CodeEditor)
      ↓
AppShell.buildRequest() → ExplanationRequest
      ↓
useExplanation()  ── idle → loading → loaded | error, with cancellation
      ↓
explainCode()                     ← src/services/explanationService.ts
      ↓
provider   ── mockProvider (today)  |  httpProvider (once configured)
      ↓                                      ↓
local catalog                        POST /api/explain  ← your backend, to build
                                               ↓
                                         LLM provider
      ↓
Explanation
      ↓
ExplanationPanel
```

### The request

One shape, defined as `ExplanationRequest` in `src/types/explanation.ts` and built in `AppShell.buildRequest()`:

```ts
{
  selectedCode: string          // what the user highlighted
  language: LanguageId          // 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'json'
  surroundingContext: {
    fullSource: string          // the whole active file
    range: SourceRange | null   // where the selection sits in it (1-based, Monaco coords)
  }
  fileName?: string             // e.g. "fetchUsers.js"
  projectContext?: ProjectContext   // reserved — nothing populates it yet
}
```

`projectContext` is a placeholder so project-wide intelligence can be added without changing the shape. There is no AST analysis, no embeddings and no cross-file indexing — do not add them to make this work.

### The response

`explainCode()` resolves to an `Explanation`. The panel renders these fields and nothing else:

| Canonical name | Field in this codebase | Rendered as |
| --- | --- | --- |
| `title` | `concept` | Badge next to the selected code |
| `whatIsIt` | `simpleExplanation` | **What is it?** |
| `technicalDefinition` | `definition` | **Technical definition** |
| `inThisCode` | `contextualExplanation` | **In this code** |
| `whyItsHere` | `whyItExists` | **Why is it here?** |
| `relatedConcepts[].name` | `relatedConcepts[].label` | Clickable chip |
| `relatedConcepts[].explanation` | `relatedConcepts[].hint` | Chip tooltip |

Plus `id`, `selectedCode`, `language` and `kind` (a `ConceptKind` used for the badge label). The internal names are what the components already use, so leave them alone — `httpProvider` accepts **either** vocabulary from the backend and normalizes to the internal one in `parseExplanationResponse()`.

### The current mock

`src/services/explanationProviders/mockProvider.ts` answers from the curated catalog in `src/data/mockExplanations.ts`. It simulates 550–950 ms of latency so the loading state is real, and throws `not_found` for unknown selections so the error state is real. It is selected automatically whenever no API URL is configured, so the app keeps working offline.

### What to replace when connecting a real LLM

1. **Build the backend route** (it does not exist yet — this is a Vite SPA, so add a server or a serverless function, e.g. `/api/explain`). It receives the `ExplanationRequest` JSON, builds the prompt, calls the LLM, and returns a JSON body using either vocabulary from the table above.
2. **Set `VITE_EXPLANATION_API_URL`** to that route's path. That is the whole client-side switch: `selectProvider()` in `explanationService.ts` picks `httpProvider` the moment the variable is set, and falls back to the mock when it is not.
3. **Adjust `parseExplanationResponse()`** in `httpProvider.ts` only if your backend's field names differ from both vocabularies. It is also the guard that turns a malformed or truncated model answer into an `invalid_response` error instead of a crash.
4. **Leave the UI alone.** `AppShell`, `ExplanationPanel` and `useExplanation` should need no changes. If you find yourself editing a component to connect the API, the seam has been crossed in the wrong direction.

### Where the API key lives

**On the server. Never in this repository's `src/`.**

Vite inlines every `VITE_`-prefixed variable into the JavaScript bundle it ships to the browser, so a key in one is published to anyone who opens devtools. `VITE_EXPLANATION_API_URL` is a *location*, not a credential — that is why it is the only client variable.

The LLM credential is read by the backend route, server-side, as something like `LLM_API_KEY`, and never forwarded to the client. See `.env.example`; `.env*` files are gitignored. No key is created or required to run the app today.

### Errors

`explainCode()` rejects with an `ExplanationError` carrying a code: `not_found`, `aborted`, `unknown`, `network`, `timeout`, `rate_limited`, `invalid_response`, `server_error`. `useExplanation` wraps anything unclassified into `unknown`, and the panel has a suggestion for every code, so a future API failure is displayed rather than thrown. Superseded requests are aborted via `AbortSignal` and never reach the panel.

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
