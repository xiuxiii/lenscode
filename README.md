# LensCode

**Google Lens for code.** Paste code, highlight any part of it, and get a plain-language explanation of exactly what you are looking at.

A polished, fully interactive frontend with a small LLM-backed explanation route. Explanations come from DeepSeek (or any OpenAI-compatible model) using a server-side API key. There is no database, auth or user accounts.

## Core flow

```
PASTE CODE → SELECT CODE → EXPLAIN → READ EXPLANATION
```

1. The app opens directly into the workspace with a realistic starter file. Use **Open folder** or **Open files** (or drag them onto the window) to load your own code, or click **+** for a blank file and paste any code or terminal command into it.
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

### Adding your API key (DeepSeek)

```bash
cp .env.example .env.local
# open .env.local and paste your key after LLM_API_KEY=
npm run dev
```

Without a key the app still opens, but **Explain** shows "No LLM_API_KEY is configured" with instructions. `.env.local` is gitignored.

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
    FileSidebar/        Open folder / files, import summary, folder tree, recent explanations
      FileTree          Collapsible tree built from file paths
    CodeEditor/         Monaco wrapper, selection tracking, floating action, theme + workers
      EditorToolbar     File name, detected-language badge, persistent Explain button
    LanguageBadge/      Read-only language badge (toolbar) + plain-English intro (panel)
    SelectionActions/   Floating "Explain" pill + shared ExplainButton
    ExplanationPanel/   All panel states (empty, selected, loading, loaded, error) + "Ask about this"
      ExplanationSection, RelatedConcepts
    StatusBar/          Explanation status, cursor, selection, language, file
  hooks/
    useExplanation.ts   Reducer-based state machine (idle → loading → loaded | error) with cancellation
    useWorkspace.ts     The project: name, files (by path), active file, open/add/close
    useSessionPersistence.ts  Autosaves the workspace and history (debounced, flushed on page hide)
  services/
    explanationService.ts       explainCode() — the only door between UI and AI
    parseExplanation.ts         Validates answers (shared with the server)
  data/
    starterFiles.ts         Files that open by default
    languages.ts            Supported languages, colours and one-line beginner descriptions
  lib/
    detectLanguage.ts       Automatic language detection (offline, runs on every edit)
    importFiles.ts          Reads opened / dropped files and folders, with safety filtering
    sessionStore.ts         Saves / restores the project and history in this browser (IndexedDB)
  types/
    explanation.ts          Explanation, ExplanationRequest, ExplanationError
    workspace.ts            WorkspaceFile, CodeSelection, LanguageId
```

## Opening your own code

**Open folder** loads a whole project and replaces the current one. **Open files** adds individual files to it. Both also work by dragging onto the window. Files are read in the browser and never uploaded; only the code you choose to explain is sent to the AI, along with the lines around it.

`src/lib/importFiles.ts` decides what gets opened, and the sidebar says what was left out and why:

- **Not your code:** `node_modules`, `.git`, `dist`, `build`, `.next`, virtualenvs, `__pycache__`, `target` and similar folders are skipped. When dropped, they are not even walked.
- **Secrets are never read:** `.env`, `.env.local` and other `.env.*` files, `.npmrc`, private keys (`*.pem`, `id_rsa`, …). Templates like `.env.example` are fine.
- **Not text:** images, fonts, archives and executables by extension, plus anything containing NUL bytes.
- **Too big:** files over 500 KB (the most one explanation can send), and more than 2,000 files or 25 MB in total.

A folder opens on its `README` if it has one.

## Saved between visits

Your project, its files (including edits), the open file and your recent explanations are kept in this browser and come back after a refresh or restart. They are never uploaded.

- **Where:** `src/lib/sessionStore.ts` stores them in IndexedDB, in this browser on this computer only. IndexedDB rather than `localStorage` because a project can be up to 25 MB. Saves wait for a 400 ms pause in typing and only rewrite files that changed.
- **No lost keystrokes:** IndexedDB writes are asynchronous and a browser may abandon one when the page unloads. So the latest text is also written synchronously to `localStorage` as a draft when the page is hidden, applied on the next load, and dropped once a normal save has caught up.
- **Recent explanations are saved in full.** Clicking one shows it instantly without asking the AI again, so there is no extra cost.
- **Starting over:** the **×** next to a folder's name closes it and returns to the example project (your files on disk are not touched). On the example project the same button resets it. **Clear** empties Recent.
- **Safe failure:** if storage is unavailable (some private windows) or the saved data is unreadable or from an incompatible version, the app starts fresh rather than breaking. `loadSession()` is awaited before the first render, with a 1.5 s cap, so a reload never flashes the example project first.

Two tabs open at once share the same save, and the last one to save wins.

## Language detection

Nobody picks a language. `src/lib/detectLanguage.ts` scores the code against telltale patterns for each language (`def name():` means Python, a line starting with `git ` or `npm ` means a terminal command, `SELECT … FROM` means SQL) and the highest score wins. It runs instantly and offline whenever a file changes.

- **Recognises:** terminal commands (Bash/Zsh), PowerShell, JavaScript, TypeScript, Python, HTML, CSS, JSON, SQL, Java, C, C++, C#, Go, Rust, PHP, Ruby, YAML, Markdown and Dockerfiles. Anything else shows as "Not detected yet".
- **File extensions are hints, not verdicts.** Pasting Python into `notes.js` still shows Python.
- **No flicker while typing.** A file keeps its language until the new code clearly points elsewhere.
- **The model double-checks.** The prompt marks the language as auto-detected and tells the model to explain the code as whatever it really is.

To add a language, add an entry to `src/data/languages.ts` (its `id` must be a Monaco language id) and its patterns to `SIGNALS` in `detectLanguage.ts`.

## AI API Integration

*Written for the next developer picking this up. The DeepSeek integration is built and tested against a protocol-compatible stand-in; it needs a server-side key to answer (see [Adding your API key](#adding-your-api-key-deepseek)).*

### Where the boundary is

`src/services/explanationService.ts` is the only door between the UI and whatever produces explanations. It exports one function:

```ts
const explanation = await explainCode(request, { signal })
```

The UI calls it through `useExplanation()` and nowhere else. It does **not** know which model runs, how auth works or how the prompt is built. Keep it that way: everything provider-specific stays on the server.

```
Code selection (CodeEditor)
      ↓
AppShell.buildRequest() → ExplanationRequest
      ↓
useExplanation()  ── idle → loading → loaded | error, with cancellation
      ↓
explainCode()                     ← src/services/explanationService.ts
      ↓
POST /api/explain                 ← server/vitePlugin.ts
      ↓
server/explain/handler.ts
  validate → prompt.ts → llmClient.ts
      ↓
DeepSeek /chat/completions (JSON mode)
      ↓
parseExplanationResponse()        ← rejects bad answers (server, then browser)
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

Plus `id`, `selectedCode`, `language` and `kind` (a `ConceptKind` used for the badge label). The internal names are what the components already use, so leave them alone — `parseExplanationResponse()` accepts **either** vocabulary and normalizes to the internal one.

### The backend route

`server/` runs only in Node. `server/vitePlugin.ts` mounts `POST /api/explain` on the Vite dev and preview servers, so `npm run dev` is the whole backend locally.

- **No key.** Without `LLM_API_KEY` the route answers `503` with code `not_configured`, and the panel says how to add one.
- **Prompt.** `server/explain/prompt.ts` sends the selection plus a window of ±40 lines around it (capped at 12,000 characters), with the selected lines marked. When there is no range (a related-concept click), it sends the top of the file and tells the model the selection may be a concept name. The model is asked for the canonical field names, with identifiers in double quotes, which `renderProse()` already turns into inline code chips.
- **Model call.** `server/explain/llmClient.ts` POSTs to `{LLM_BASE_URL}/chat/completions` with `response_format: { type: 'json_object' }`, a 40 s timeout, and the browser's abort signal, so a superseded selection cancels the upstream call instead of spending tokens.
- **Validation.** `handler.ts` rejects malformed requests with a 400, extracts the JSON object even if a model wraps it in a fence, and runs the same `parseExplanationResponse()` the browser uses, so a bad answer becomes a clean `invalid_response` error.

| Setting | Default | Notes |
| --- | --- | --- |
| `LLM_API_KEY` | — | Required. Server only. |
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

`explainCode()` rejects with an `ExplanationError` carrying a code: `not_configured`, `aborted`, `unknown`, `network`, `timeout`, `rate_limited`, `invalid_response`, `server_error`. `useExplanation` wraps anything unclassified into `unknown`, and the panel has a suggestion for every code, so an API failure is displayed rather than thrown. The route reports failures as `{ error: { code, message } }`, and `explainCode()` shows that message. Superseded requests are aborted via `AbortSignal` and never reach the panel.

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
