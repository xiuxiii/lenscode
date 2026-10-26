# LensCode

**Google Lens for code.** Paste code, highlight any part of it, and get a plain-language explanation of exactly what you are looking at.

A polished, fully interactive frontend with a small LLM-backed explanation route. Explanations come from DeepSeek (or any OpenAI-compatible model) using a server-side API key. There is no database, auth or user accounts.

## Core flow

```
PASTE CODE → SELECT CODE → EXPLAIN → READ EXPLANATION
```

1. The app opens on a start screen. Click **Start a new session** for a blank file to paste any code or terminal command into, use **Open a folder** / **Open files**, or drop them anywhere on the window. New to it? **Open tutorial** at the bottom opens a small practice project with a step-by-step guide. Inside a session, **New session** (top right) or the LensCode logo goes back to the start screen, and **Open…** in the sidebar adds more files.
2. The language is detected automatically from the code. There is nothing to choose. The editor's tab bar names it, and the explanation says in one plain-English line what that language is.
3. Highlight a keyword, a name, a call, a command, or a whole line in the editor.
4. Let go of the mouse and it is explained straight away (a drag, a double-click on a word, or a click on a line number all count). Selections made with the keyboard get a small **Explain** pill instead: click it, press `⌘E` / `Ctrl+E`, use the editor context menu, or click **Explain** in the tab bar.
5. The explanation panel on the right shows what it is, the technical definition, what it does in this code, why it is here, and related concepts to learn next. Risky commands (`rm -rf`, `curl … | sh`, `sudo`, force-pushes, `reset --hard`, `DROP TABLE` and the like) also get a fixed warning from the app itself (`src/lib/riskyCommands.ts`), so nothing written in the file, and nothing the AI says, can talk the risk away.
6. Click a related concept to explain that next, or type a question into **Ask a follow-up…** under the explanation ("why not just…?", "what does that word mean?"). Answers appear under the explanation and remember the earlier questions in the thread. The sidebar keeps a short history of what you have explained.

Outside the app, the `lens` command explains code and commands in the terminal, and can be put on a keyboard shortcut on a Mac, in zsh and in VS Code (see [From the terminal and other apps](#from-the-terminal-and-other-apps)).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ (including /api/explain)
npm run lint
npm test           # unit tests (Vitest), about a second; npm run test:watch to re-run on save
npm run build:cli  # the lens command, into dist-cli/ (see "From the terminal and other apps")
```

Node 20.3+ is required for the API route and for `lens`; 22 is recommended.

### Tests

The tests sit next to the code they cover (`*.test.ts`) and need no API key: the AI provider is replaced by a fake `fetch`. They cover:

- **The `lens` command:** options, `.env` parsing, output, AppleScript escaping and the setup text, plus the whole command run against a fake AI: arguments and stdin, `--json`, `--open`, `--popup`, a missing key and text that is too long. Also building and reading `#explain=` links.
- **Language detection:** a corpus of 75 snippets across every supported language, plus file-name hints and the "don't flicker while typing" rules.
- **Opening files:** secrets are never read, dependency/build folders, binaries and oversized files are left out, and the size and count caps.
- **The API route:** request validation, the prompt sent upstream, and every error the panel can show (bad key, no credit, rate limits, timeouts, malformed or truncated answers). Also checks that the key never appears in an error or a log line.
- **The browser side:** answer parsing and how `explainCode()` maps failures.

### Adding your API key (DeepSeek)

```bash
cp .env.example .env.local
# open .env.local and paste your key after LLM_API_KEY=
npm run dev
```

Without a key the app still opens, but **Explain** shows "No LLM_API_KEY is configured" with instructions. `.env.local` is gitignored.

## From the terminal and other apps

Highlight a command in Terminal, VS Code or Claude Code and have it explained, without opening the app first.

### The `lens` command

```bash
npm run build:cli && npm link   # once: builds dist-cli/lens.mjs and installs `lens`
lens 'git push --force'         # explain a command or a piece of code
pbpaste | lens                  # explain what you copied (macOS)
lens < script.sh                # explain a file (up to 8,000 characters)
```

`lens` prints the app's risky-command warnings first (decided locally, so they show even if the AI call fails), then the title, the plain answer, **In this code**, **Why it's here** and related concepts. It runs the web app's own engine (`createExplainHandler`: same prompt, same answer checks) with the whole text as the selection, and reads `LLM_API_KEY` from your shell or from `.env.local` / `.env` in the LensCode folder, so it works from any directory. Run `npm run build:cli` again after pulling changes.

`lens` never runs the text it is given, but your shell can before `lens` sees it: inside double quotes, `$(…)` and backticks still run. Use single quotes, or pipe the text in.

Options go before the text (`lens git push --force` explains all three words):

- `--open` opens the text in LensCode in your browser (see below), at `LENSCODE_URL` (default `http://localhost:5173`, where `npm run dev` serves it; set it to your Vercel address to use the deployed app instead). `lens` says so if nothing answers there.
- `--popup` shows the explanation in a macOS dialog, warnings first, with **Open in LensCode** and **OK**. On other systems it prints instead.
- `--json` prints the explanation as JSON; warnings go to stderr.
- `--setup-mac` and `--setup-zsh` print the setup steps below; `--help` and `--version`.

Colour is used only on a terminal, and never with `NO_COLOR` set.

### Opening LensCode with text

`http://localhost:5173/#explain=<URL-encoded text>`, the link `--open` builds, explains that text in the app (`src/hooks/useDeepLink.ts`). With a session open, the text is added to it as a new file (`snippet`, then `snippet-2`, …); with none, a new session starts with it. It is explained straight away, as if all of it were selected, and the `#explain=` part is then removed, so a reload doesn't repeat it. Text is cut to 8,000 characters. It stays after the `#`, which browsers never send to a server.

### In other apps

- **macOS (Terminal and most apps):** `lens --setup-mac` prints the steps for a Shortcut that receives the highlighted text through the Services menu and runs `lens --popup` (or `--open`) on it, with the exact command to paste. The command names Node and the CLI by their full paths, because Shortcuts and Services don't load your shell's PATH. The last step gives it a keyboard shortcut in **System Settings → Keyboard → Keyboard Shortcuts → Services**.
- **zsh:** `lens --setup-zsh >> ~/.zshrc` adds **Ctrl+X Ctrl+L**, which explains the command you are typing without running it and leaves it on the line.
- **Claude Code:** run `lens` as a shell command from the prompt: `! lens 'npm run build'`. The explanation appears in the conversation, and Claude sees it too. For text in Claude's reply, copy it and run `! pbpaste | lens`.
- **VS Code:** add this to `keybindings.json` (**Preferences: Open Keyboard Shortcuts (JSON)**). With code selected, Ctrl+Alt+L explains it in the terminal panel:

  ```jsonc
  {
    "key": "ctrl+alt+l",
    "command": "workbench.action.terminal.sendSequence",
    "args": { "text": "\u0005\u0015lens <<'LENSCODE_END'\n${selectedText}\nLENSCODE_END\n" },
    "when": "editorHasSelection"
  }
  ```

  It types into the terminal: Ctrl+E Ctrl+U (`\u0005\u0015`) clears anything half-typed there, then the selection goes to `lens` as a here-document. Because `'LENSCODE_END'` is quoted, the shell expands nothing inside it, so quotes, `$(…)` and backticks in the selection reach `lens` as plain text. The shorter `lens '${selectedText}'` is not safe: a `'` in the selection ends the quoting, and the shell can then run part of it. Limits: bash or zsh only (not PowerShell or cmd); the terminal must be at a prompt, since the keys go to whatever is running there; tabs in the selection set off the shell's completion and can change the text; and a selected line that is exactly `LENSCODE_END` would end the text early and run the lines after it.

The macOS parts (`--popup`, opening the browser with `open`, the Shortcut steps) were written and unit-tested on Linux and have not been tried on a Mac yet. The VS Code keybinding was checked by typing the same keys into bash and zsh, not in VS Code itself. The zsh shortcut was tried in zsh 5.9.

## Stack

- React 19 + TypeScript, built with Vite
- Monaco Editor (bundled locally, no CDN), with web workers for JS/TS, HTML, CSS and JSON
- Plain CSS with design tokens; no UI framework
- Geist Sans and Geist Mono, self-hosted via `@fontsource` (no font CDN)

## Design system

All tokens live in the `:root` block of `src/index.css`; component CSS uses tokens only (no raw colours). The Monaco theme in `CodeEditor/monacoSetup.ts` mirrors the same values, because Monaco can't read CSS variables.

- **Type:** integer sizes only — 12 (meta), 13 (rows, controls, headings), 14 (body, buttons), 16 (the lead answer), 20 (the selected-symbol title). Weights 400 and 500; 600 only for the title and the wordmark.
- **Colour:** zero-chroma greys (`#0a0a0a` / `#111` / `#1a1a1a`, hairlines at 8% and 14.5% white). Text is `#ededed` / `#a1a1a1` / `#878787`, all at least 4.5:1 where used. Blue (`#0070f3`) is only for focus rings, the editor cursor and selection, the explained-range underline and the resizer line on hover or drag. Regions are separated by hairlines; the only shadows are on the floating pill and the **Open…** menu. Primary buttons are light with dark text and rare: the mobile **Explain** button, and the send arrow once there is a question.
- **Shape:** radius 6 for controls and rows, 8 for cards, menus and the composer, 4 for inline code and kbd, 12 only for the mobile sheet. Controls are 28 or 32px high (40 for the composer and the mobile Explain button); the top bar is 48px and every column header 40px, so their borders form one line.
- **Buttons:** `.btn--primary`, `.btn--secondary`, `.btn--ghost` and `.icon-btn`, defined once in `index.css`. Shortcuts live in tooltips, not inside buttons.
- **Editor:** at most four syntax hues (keywords, strings, types/tags, numbers), each at least 8:1 on the background; punctuation grey, comments upright. Bracket-pair colourisation is switched off at the *model* level in `monacoSetup.ts`: in standalone Monaco the editor option alone doesn't reach models.
- **Mobile (≤768px):** the sidebar becomes a drawer, the panel a draggable bottom sheet (45–85% tall), and a fixed **Explain** button appears with a selection.

## Project structure

```
cli/                    The lens command; npm run build:cli bundles it into dist-cli/lens.mjs
  main.ts               Reads the text, warns, calls the explain handler, prints the answer
  args.ts, env.ts       Options; settings from the shell, .env.local and .env
  format.ts, popup.ts   Terminal output; the macOS dialog (AppleScript)
  setup.ts              --setup-mac and --setup-zsh
server/                 Runs in Node only; never bundled for the browser
  vitePlugin.ts         Mounts POST /api/explain and /api/followup on the dev + preview servers
  explain/
    handler.ts          Request → validate → prompt → LLM → validated Explanation (or follow-up answer)
    prompt.ts           The prompts and context windowing (the only place they live)
    llmClient.ts        OpenAI-compatible chat-completions call + error mapping
    config.ts           LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
src/
  components/
    AppShell/           Layout grid, state wiring, panel resizer, mobile drawer + bottom sheet
    TopBar/             Sidebar toggle, logo, project name
    FileSidebar/        "Open…" menu, import summary, folder tree, recent explanations
      FileTree          Collapsible tree built from file paths
    CodeEditor/         Monaco wrapper, selection tracking, pill placement, theme + workers
      EditorToolbar     Tab bar: file name, detected language, Explain
    SelectionActions/   The floating "Explain" pill
    ExplanationPanel/   All panel states (empty, selected, loading, loaded, error) + follow-up thread and composer
      ExplanationSection, RelatedConcepts
  hooks/
    useExplanation.ts   Reducer-based state machine (idle → loading → loaded | error) with cancellation
    useDeepLink.ts      Explains the text in an #explain= link (lens --open)
    useWorkspace.ts     The project: name, files (by path), active file, open/add/close
    useSessionPersistence.ts  Autosaves the workspace and history (debounced, flushed on page hide)
  services/
    explanationService.ts       explainCode() — the only door between UI and AI
    parseExplanation.ts         Validates answers (shared with the server)
  data/
    starterFiles.ts         The tutorial project (a guide plus practice files)
    languages.ts            Supported languages, colours and one-line beginner descriptions
  lib/
    deepLink.ts             Builds and reads #explain= links
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
- **Where a reload lands:** back in your saved session if there is one. The tutorial and a first visit start on the start screen, which offers to continue the last session.
- **Starting over:** starting a new session replaces the current one. The **×** in the sidebar closes the session and forgets it (your files on disk are not touched); the tutorial is restarted from the start screen. **Clear** empties Recent.
- **Safe failure:** if storage is unavailable (some private windows) or the saved data is unreadable or from an incompatible version, the app starts fresh rather than breaking. `loadSession()` is awaited before the first render, with a 1.5 s cap, so a reload never flashes the start screen before your session.
- **Slow storage never loses data:** if reading the saved session takes longer than 1.5 s, the app starts on the start screen without it and writes nothing until the read finishes. The project then appears under "Pick up where you left off" and Recent is merged back in. If you started something new in the meantime, that new session replaces the old one, as it always does.

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

`src/services/explanationService.ts` is the only door between the UI and whatever produces explanations. It exports two functions:

```ts
const explanation = await explainCode(request, { signal })
const { answer } = await askFollowUp({ request, explanation, previous, question }, { signal })
```

The UI calls them through `useExplanation()` and `useFollowUps()` and nowhere else. It does **not** know which model runs, how auth works or how the prompt is built. Keep it that way: everything provider-specific stays on the server.

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
| `title` | `concept` | The line under the selected-code title |
| `whatIsIt` | `simpleExplanation` | The lead answer (large, no heading) |
| `technicalDefinition` | `definition` | **Technical definition** |
| `inThisCode` | `contextualExplanation` | **In this code** |
| `whyItsHere` | `whyItExists` | **Why it's here** |
| `relatedConcepts[].name` | `relatedConcepts[].label` | A related-concept row (click to explain it) |
| `relatedConcepts[].explanation` | `relatedConcepts[].hint` | The row's grey description |

Plus `id`, `selectedCode`, `language` and `kind` (a `ConceptKind`, validated but not currently displayed). The internal names are what the components already use, so leave them alone — `parseExplanationResponse()` accepts **either** vocabulary and normalizes to the internal one.

### The backend route

`server/` runs only in Node. `server/vitePlugin.ts` mounts `POST /api/explain` on the Vite dev and preview servers, so `npm run dev` is the whole backend locally.

- **No key.** Without `LLM_API_KEY` the route answers `503` with code `not_configured`, and the panel says how to add one.
- **Prompt.** `server/explain/prompt.ts` sends the selection plus a window of ±40 lines around it (capped at 12,000 characters), with the selected lines marked. The selection and file are framed as data: the model is told never to follow instructions found inside them (a file can contain text aimed at an AI) and never to call a destructive command safe. When there is no range (a related-concept click), it sends the top of the file and tells the model the selection may be a concept name. The model is asked for the canonical field names, with identifiers in double quotes, which `renderProse()` already turns into inline code chips.
- **Model call.** `server/explain/llmClient.ts` POSTs to `{LLM_BASE_URL}/chat/completions` with `response_format: { type: 'json_object' }`, a 40 s timeout, and the browser's abort signal, so a superseded selection cancels the upstream call instead of spending tokens.
- **Validation.** `handler.ts` rejects malformed requests with a 400, extracts the JSON object even if a model wraps it in a fence, and runs the same `parseExplanationResponse()` the browser uses, so a bad answer becomes a clean `invalid_response` error.
- **Follow-ups.** `POST /api/followup` takes a `FollowUpRequest`: the original `ExplanationRequest`, the explanation the reader saw, up to 6 earlier question/answer pairs (the route accepts 10), and the new question (up to 2,000 characters). `buildFollowUpMessages()` sends the same file context as the explanation, then the thread as alternating user/assistant turns, and asks for `{ "answer": "…" }`: plain text, paragraphs separated by a blank line, identifiers in double quotes. Errors use the same codes as `/api/explain`. Threads live only in the panel: a new explanation starts a fresh one, and they are not saved with Recent.

| Setting | Default | Notes |
| --- | --- | --- |
| `LLM_API_KEY` | — | Required. Server only. |
| `LLM_BASE_URL` | `https://api.deepseek.com` | Any OpenAI-compatible API, e.g. Ollama at `http://localhost:11434/v1`. |
| `LLM_MODEL` | `deepseek-chat` | If DeepSeek has renamed its models, the panel says so; set the current name here. |
| `LLM_TIMEOUT_MS` | `40000` | Kept below the browser's 45 s timeout so the server's clearer error wins. |

Upstream failures come back as readable messages in the panel: a rejected key ("Check LLM_API_KEY in .env.local"), no credit (HTTP 402), an unknown model ("Check LLM_MODEL"), rate limiting, timeouts, truncated or malformed answers. They are also logged in the dev-server terminal, without the key.

### Deploying

The dev and preview servers host the routes. Static hosting of `dist/` alone does not, so in production `/api/explain` and `/api/followup` need a home.

**Vercel** is set up: `api/explain.ts` and `api/followup.ts` wrap `createExplainHandler()` and `createFollowUpHandler()` as Vercel Functions, and `vercel.json` pins the Vite framework preset. To deploy:

1. Import the repository at [vercel.com/new](https://vercel.com/new). The defaults (Vite, `npm run build`, output `dist`) are correct.
2. In the project's **Settings → Environment Variables**, add `LLM_API_KEY` (and any of the optional `LLM_*` values) for Production and Preview. Redeploy after changing them.

`api/tsconfig.json` turns on `rewriteRelativeImportExtensions`, so the `.ts` imports in `server/` become `.js` when Vercel compiles the functions. Without it the functions fail at runtime with `ERR_MODULE_NOT_FOUND`.

On another `fetch`-style host (Netlify, Cloudflare), the same two handlers take a Web-standard `Request` and return a `Response`; only the export shape changes.

Set `LLM_API_KEY` in the host's secret settings, not in a file. If the API is served from a different origin than the page, set `VITE_EXPLANATION_API_URL` to its URL at build time. Follow-ups go to the same URL with its final `/explain` replaced by `/followup` (or `/followup` appended if it has none).

### Where the API key lives

**On the server. Never in this repository's `src/`.**

Vite inlines every `VITE_`-prefixed variable into the JavaScript bundle it ships to the browser, so a key in one is published to anyone who opens devtools. `VITE_EXPLANATION_API_URL` is a *location*, not a credential — that is why it is the only client variable.

`LLM_API_KEY` is read by `server/vitePlugin.ts` (via `loadEnv`) and `server/explain/config.ts`, used only in the `Authorization` header of the upstream call, and never forwarded to the client. A production build made with a key present was scanned: the key, the base URL, the model name and the prompt are all absent from `dist/`. Put it in `.env.local`, which is gitignored.

### Errors

`explainCode()` rejects with an `ExplanationError` carrying a code: `not_configured`, `aborted`, `unknown`, `network`, `timeout`, `rate_limited`, `invalid_response`, `server_error`. `useExplanation` wraps anything unclassified into `unknown`, and the panel has a suggestion for every code, so an API failure is displayed rather than thrown. The route reports failures as `{ error: { code, message } }`, and `explainCode()` shows that message. Superseded requests are aborted via `AbortSignal` and never reach the panel.

## Interaction states covered

| State | What the panel shows |
| --- | --- |
| No selection | "Select some code to explain it", centred, with the one keyboard hint |
| Selected, not explained | The selected code as a title, and "Press ⌘E or click Explain" |
| Loading | The title, then a skeleton shaped like the answer; the header says "Explaining…" |
| Loaded | Title, kind, the lead answer, three short sections, related concepts as rows, and the follow-up box |
| Error | The title, what went wrong, a suggestion, and **Retry** |
| Explained, then new selection | A quiet "New selection:" row above the current explanation |

While an explanation is open, the explained range stays subtly underlined in the editor so the code and the panel stay visibly linked.
