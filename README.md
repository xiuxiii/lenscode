# LensCode

**Google Lens for code.** Paste code, highlight any part of it, and get a plain-language explanation of exactly what you are looking at.

A polished, fully interactive frontend with a small LLM-backed explanation route. Explanations come from DeepSeek (or any OpenAI-compatible model) when a server-side API key is configured, and from a built-in mock catalog when it is not. There is no database, auth or user accounts.

## Core flow

```
PASTE CODE → SELECT CODE → EXPLAIN → READ EXPLANATION
```

1. The app opens directly into the workspace with a realistic starter file. Click **+** for a blank file and paste any code or terminal command into it.
2. The language is detected automatically from the code. There is nothing to choose. The toolbar badge and the top of the explanation panel say what it is, in plain English.
3. Highlight a keyword, a name, a call, a command, or a whole line in the editor.
4. A small **Explain** pill appears next to the selection. Click it, press `⌘E` / `Ctrl+E`, use the editor context menu, or click the persistent **Explain** button in the toolbar.
5. The explanation panel on the right shows what it is, the technical definition, what it does in this code, why it is here, and related concepts to learn next.
6. Click a related concept to explain that next. The sidebar keeps a short history of what you have explained.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ (including /api/explain)
npm run lint
```

Node 20.3+ is required for the API route; 22 is recommended.

### Turning on real explanations (DeepSeek)

```bash
cp .env.example .env.local
# open .env.local and paste your key after LLM_API_KEY=
npm run dev
```

The status bar switches from **Local mock** to **API**. Remove the key to go back to the mock. `.env.local` is gitignored.

## Stack

- React 19 + TypeScript, built with Vite
- Monaco Editor (bundled locally, no CDN), with web workers for JS/TS, HTML, CSS and JSON
- Plain CSS with design tokens; no UI framework

## Project structure

```
server/                 Runs in Node only; never bundled for the browser
  vitePlugin.ts         Mounts POST /api/explain on the dev + preview servers
  explain/
    handler.ts          Request → validate → prompt → LLM → validated Explanation
    prompt.ts           The prompt and context windowing (the only place it lives)
    llmClient.ts        OpenAI-compatible chat-completions call + error mapping
    config.ts           LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
src/
  components/
    AppShell/           Layout grid, workspace + explanation state wiring, panel resizer
    TopBar/             Brand, project switcher placeholder, settings
    FileSidebar/        Starter files, "new file", recent explanations
    CodeEditor/         Monaco wrapper, selection tracking, floating action, theme + workers
      EditorToolbar     File name, detected-language badge, persistent Explain button
    LanguageBadge/      Read-only language badge (toolbar) + plain-English intro (panel)
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
      mockProvider.ts           Local catalog lookup (used when no key is set)
      httpProvider.ts           Client for /api/explain (used when a key is set)
  data/
    mockExplanations.ts     Curated explanation catalog (JS/TS, Python, HTML, CSS, JSON)
    starterFiles.ts         Files that open by default
    languages.ts            Supported languages, colours and one-line beginner descriptions
  lib/
    detectLanguage.ts       Automatic language detection (offline, runs on every edit)
  types/
    explanation.ts          Explanation, ExplanationRequest, ExplanationProvider
    workspace.ts            WorkspaceFile, CodeSelection, LanguageId
```

## Language detection

Nobody picks a language. `src/lib/detectLanguage.ts` scores the code against telltale patterns for each language (`def name():` means Python, a line starting with `git ` or `npm ` means a terminal command, `SELECT … FROM` means SQL) and the highest score wins. It runs instantly and offline whenever a file changes.

- **Recognises:** terminal commands (Bash/Zsh), PowerShell, JavaScript, TypeScript, Python, HTML, CSS, JSON, SQL, Java, C, C++, C#, Go, Rust, PHP, Ruby, YAML, Markdown and Dockerfiles. Anything else shows as "Not detected yet".
- **File extensions are hints, not verdicts.** Pasting Python into `notes.js` still shows Python.
- **No flicker while typing.** A file keeps its language until the new code clearly points elsewhere.
- **The model double-checks.** The prompt marks the language as auto-detected and tells the model to explain the code as whatever it really is.

To add a language, add an entry to `src/data/languages.ts` (its `id` must be a Monaco language id) and its patterns to `SIGNALS` in `detectLanguage.ts`.

## AI API Integration

*Written for the next developer picking this up. The DeepSeek integration is built and tested against a protocol-compatible stand-in; to switch it on, add a key (see [Turning on real explanations](#turning-on-real-explanations-deepseek)).*

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
provider   ── mockProvider (no key)  |  httpProvider (key set)
      ↓                                      ↓
local catalog                        POST /api/explain   ← server/vitePlugin.ts
                                               ↓
                                     server/explain/handler.ts
                                       validate → prompt.ts → llmClient.ts
                                               ↓
                                     DeepSeek /chat/completions (JSON mode)
                                               ↓
                                     parseExplanationResponse() — rejects bad answers
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
  language: LanguageId          // auto-detected: 'python', 'shell', 'sql', … or 'plaintext'
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

`src/services/explanationProviders/mockProvider.ts` answers from the curated catalog in `src/data/mockExplanations.ts`. It simulates 550–950 ms of latency so the loading state is real, and throws `not_found` for unknown selections so the error state is real. It is used whenever no key is configured, so the app keeps working offline.

### The backend route

`server/` runs only in Node. `server/vitePlugin.ts` mounts `POST /api/explain` on the Vite dev and preview servers, so `npm run dev` is the whole backend locally.

- **Switching.** When `LLM_API_KEY` is present, the plugin defines `VITE_EXPLANATION_API_URL=/api/explain` for the client, and `selectProvider()` in `explanationService.ts` picks `httpProvider`. With no key, nothing is defined and the mock is used. An explicit `VITE_EXPLANATION_API_URL` always wins.
- **Prompt.** `server/explain/prompt.ts` sends the selection plus a window of ±40 lines around it (capped at 12,000 characters), with the selected lines marked. When there is no range (a related-concept click), it sends the top of the file and tells the model the selection may be a concept name. The model is asked for the canonical field names, with identifiers in double quotes, which `renderProse()` already turns into inline code chips.
- **Model call.** `server/explain/llmClient.ts` POSTs to `{LLM_BASE_URL}/chat/completions` with `response_format: { type: 'json_object' }`, a 40 s timeout, and the browser's abort signal, so a superseded selection cancels the upstream call instead of spending tokens.
- **Validation.** `handler.ts` rejects malformed requests with a 400, extracts the JSON object even if a model wraps it in a fence, and runs the same `parseExplanationResponse()` the browser uses, so a bad answer becomes a clean `invalid_response` error.

| Setting | Default | Notes |
| --- | --- | --- |
| `LLM_API_KEY` | — | Required to leave the mock. Server only. |
| `LLM_BASE_URL` | `https://api.deepseek.com` | Any OpenAI-compatible API, e.g. Ollama at `http://localhost:11434/v1`. |
| `LLM_MODEL` | `deepseek-chat` | If DeepSeek has renamed its models, the panel says so; set the current name here. |
| `LLM_TIMEOUT_MS` | `40000` | Kept below the browser's 45 s timeout so the server's clearer error wins. |

Upstream failures come back as readable messages in the panel: a rejected key ("Check LLM_API_KEY in .env.local"), no credit (HTTP 402), an unknown model ("Check LLM_MODEL"), rate limiting, timeouts, truncated or malformed answers. They are also logged in the dev-server terminal, without the key.

### Deploying

The dev and preview servers host the route. Static hosting of `dist/` alone does not, so in production `/api/explain` needs a home. `createExplainHandler()` takes a Web-standard `Request` and returns a `Response`, so on a `fetch`-style serverless runtime (Vercel, Netlify, Cloudflare) it is a few lines. The exact export shape depends on the host; this sketch is untested on any of them:

```ts
import { readLlmConfig } from '../server/explain/config.ts'
import { createExplainHandler } from '../server/explain/handler.ts'
const handle = createExplainHandler({ config: readLlmConfig(process.env) })
export const POST = (request: Request) => handle(request)
```

Set `LLM_API_KEY` in the host's secret settings, not in a file. If the API is served from a different origin than the page, set `VITE_EXPLANATION_API_URL` to its URL at build time.

### Where the API key lives

**On the server. Never in this repository's `src/`.**

Vite inlines every `VITE_`-prefixed variable into the JavaScript bundle it ships to the browser, so a key in one is published to anyone who opens devtools. `VITE_EXPLANATION_API_URL` is a *location*, not a credential — that is why it is the only client variable.

`LLM_API_KEY` is read by `server/vitePlugin.ts` (via `loadEnv`) and `server/explain/config.ts`, used only in the `Authorization` header of the upstream call, and never forwarded to the client. A production build made with a key present was scanned: the key, the base URL, the model name and the prompt are all absent from `dist/`. Put it in `.env.local`, which is gitignored.

### Errors

`explainCode()` rejects with an `ExplanationError` carrying a code: `not_found`, `aborted`, `unknown`, `network`, `timeout`, `rate_limited`, `invalid_response`, `server_error`. `useExplanation` wraps anything unclassified into `unknown`, and the panel has a suggestion for every code, so an API failure is displayed rather than thrown. The route reports failures as `{ error: { code, message } }`, and `httpProvider` shows that message. Superseded requests are aborted via `AbortSignal` and never reach the panel.

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
