import { LANGUAGES } from '../data/languages'
import type { Explanation } from '../types/explanation'
import type { LanguageId, WorkspaceFile } from '../types/workspace'
import { detectLanguage } from './detectLanguage'

/**
 * Keeps the user's project and explanation history across page reloads.
 *
 * Stored in IndexedDB, in this browser on this computer only — nothing is
 * sent anywhere. IndexedDB rather than localStorage because an opened folder
 * can be up to 25 MB, far past localStorage's ~5 MB.
 *
 * Layout: a `files` store (one record per file, keyed by id) and a `meta`
 * store holding the project record and the history. Saves only rewrite files
 * whose object changed since the last save, so typing in one file of a large
 * project stays cheap.
 *
 * IndexedDB writes are asynchronous, and a browser may abandon one that is
 * still running when the page unloads. So the latest text typed into each
 * file is also kept as a "draft" in memory, written synchronously to
 * localStorage when the page is hidden, and applied on the next load. Drafts
 * are dropped once a normal save has caught up with them.
 *
 * Every failure is non-fatal: if storage is unavailable or the saved data is
 * unreadable, the app simply starts fresh.
 */

const DB_NAME = 'lenscode'
const DB_VERSION = 1
const FILES = 'files'
const META = 'meta'
const PROJECT_KEY = 'project'
const HISTORY_KEY = 'history'
/** Bump when the saved shape changes incompatibly; older saves are ignored. */
const SCHEMA = 1
const LOAD_TIMEOUT_MS = 1_500
const DRAFTS_KEY = 'lenscode:drafts'

export interface SavedWorkspace {
  projectName: string
  /** True for the built-in tutorial project. */
  isExample: boolean
  files: WorkspaceFile[]
  activeFileId: string
}

export interface SavedSession {
  /** What to show: the saved project with any unsaved drafts applied. */
  workspace: SavedWorkspace | null
  history: Explanation[]
  /** Files exactly as they are in IndexedDB (before drafts), for the writer. */
  storedFiles: WorkspaceFile[]
  /** Drafts applied on load but not yet saved to IndexedDB. */
  drafts: Map<string, string>
  /**
   * Set when reading the saved session took too long and this one is an
   * empty stand-in: the real read, still running. Until it finishes the
   * writer holds every write, so a slow start can never overwrite or delete
   * what is saved (see `SessionWriter.adopt`).
   */
  late: Promise<SavedSession> | null
}

interface ProjectRecord {
  schema: number
  projectName: string
  isExample: boolean
  activeFileId: string
  /** File ids in sidebar order. */
  order: string[]
}

// ─────────────────────────── IndexedDB plumbing ───────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB open was blocked'))
  })
  // A failed open is retried on the next call instead of being cached forever.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function completion(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

// ─────────────────────────── Validation ───────────────────────────

const LANGUAGE_IDS = new Set<string>(LANGUAGES.map((l) => l.id))
const isString = (v: unknown): v is string => typeof v === 'string'

function readFile(value: unknown): WorkspaceFile | null {
  const f = value as Partial<WorkspaceFile> | null
  if (!f || !isString(f.id) || !isString(f.name) || !isString(f.path) || !isString(f.content)) {
    return null
  }
  const language: LanguageId =
    isString(f.language) && LANGUAGE_IDS.has(f.language)
      ? f.language
      : detectLanguage(f.content, { fileName: f.name })
  return { id: f.id, name: f.name, path: f.path, content: f.content, language }
}

function readProject(value: unknown): ProjectRecord | null {
  const p = value as Partial<ProjectRecord> | null
  if (
    !p ||
    p.schema !== SCHEMA ||
    !isString(p.projectName) ||
    !isString(p.activeFileId) ||
    !Array.isArray(p.order)
  ) {
    return null
  }
  return {
    schema: SCHEMA,
    projectName: p.projectName,
    isExample: p.isExample === true,
    activeFileId: p.activeFileId,
    order: p.order.filter(isString),
  }
}

function readHistory(value: unknown): Explanation[] {
  if (!Array.isArray(value)) return []
  return value.filter((e): e is Explanation => {
    const x = e as Partial<Explanation> | null
    return (
      !!x &&
      isString(x.id) &&
      isString(x.selectedCode) &&
      isString(x.concept) &&
      isString(x.simpleExplanation) &&
      isString(x.definition) &&
      isString(x.contextualExplanation) &&
      isString(x.whyItExists) &&
      Array.isArray(x.relatedConcepts) &&
      isString(x.language) &&
      LANGUAGE_IDS.has(x.language)
    )
  })
}

// ─────────────────────────── Drafts (localStorage) ───────────────────────────

function readDrafts(): Map<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? 'null') as {
      schema?: number
      drafts?: Record<string, unknown>
    } | null
    if (!raw || raw.schema !== SCHEMA || !raw.drafts) return new Map()
    return new Map(Object.entries(raw.drafts).filter((e): e is [string, string] => isString(e[1])))
  } catch {
    return new Map()
  }
}

function writeDrafts(drafts: Map<string, string>) {
  try {
    if (drafts.size === 0) localStorage.removeItem(DRAFTS_KEY)
    else localStorage.setItem(DRAFTS_KEY, JSON.stringify({ schema: SCHEMA, drafts: Object.fromEntries(drafts) }))
  } catch {
    // Full or unavailable: the IndexedDB save is still the main copy.
  }
}

// ─────────────────────────── Load ───────────────────────────

async function readSession(): Promise<Omit<SavedSession, 'drafts' | 'late'>> {
  const db = await openDb()
  const tx = db.transaction([FILES, META], 'readonly')
  const [project, rawFiles, history] = await Promise.all([
    result(tx.objectStore(META).get(PROJECT_KEY)),
    result(tx.objectStore(FILES).getAll()),
    result(tx.objectStore(META).get(HISTORY_KEY)),
  ])

  const record = readProject(project)
  let workspace: SavedWorkspace | null = null
  let storedFiles: WorkspaceFile[] = []
  if (record) {
    const byId = new Map<string, WorkspaceFile>()
    for (const raw of rawFiles) {
      const file = readFile(raw)
      if (file) byId.set(file.id, file)
    }
    const files = record.order.flatMap((id) => byId.get(id) ?? [])
    storedFiles = files
    if (files.length > 0) {
      workspace = {
        projectName: record.projectName,
        isExample: record.isExample,
        files,
        activeFileId: byId.has(record.activeFileId) ? record.activeFileId : files[0].id,
      }
    }
  }
  return { workspace, history: readHistory(history), storedFiles }
}

/** Put unsaved drafts back into the files they belong to. */
function applyDrafts(
  workspace: SavedWorkspace | null,
  drafts: Map<string, string>,
): { workspace: SavedWorkspace | null; drafts: Map<string, string> } {
  if (!workspace || drafts.size === 0) return { workspace, drafts: new Map() }
  const applied = new Map<string, string>()
  const files = workspace.files.map((f) => {
    const draft = drafts.get(f.id)
    if (draft === undefined || draft === f.content) return f
    applied.set(f.id, draft)
    return {
      ...f,
      content: draft,
      language: detectLanguage(draft, { fileName: f.name, current: f.language }),
    }
  })
  return { workspace: { ...workspace, files }, drafts: applied }
}

/**
 * Whatever was saved last time, or an empty session if there is nothing
 * usable. Never rejects and never waits longer than a moment, so it is safe
 * to await before the first render. If the read is slow, the result is an
 * empty session whose `late` carries the read still in progress.
 */
export function loadSession(): Promise<SavedSession> {
  const empty: SavedSession = {
    workspace: null,
    history: [],
    storedFiles: [],
    drafts: new Map(),
    late: null,
  }
  const load = readSession()
    .then(
      (saved): SavedSession => ({
        ...saved,
        ...applyDrafts(saved.workspace, readDrafts()),
        late: null,
      }),
    )
    .catch((err: unknown) => {
      console.warn('[lenscode] Could not restore the saved session:', err)
      return empty
    })
  const timeout = new Promise<SavedSession>((resolve) =>
    setTimeout(() => resolve({ ...empty, late: load }), LOAD_TIMEOUT_MS),
  )
  return Promise.race([load, timeout])
}

// ─────────────────────────── Save ───────────────────────────

export interface SessionWriter {
  saveWorkspace(workspace: SavedWorkspace): void
  /** Forget the saved project (the session was closed). History is kept. */
  clearWorkspace(): void
  saveHistory(history: Explanation[]): void
  /** Record the latest text of a file, synchronously, as it is typed. */
  noteDraft(fileId: string, content: string): void
  /** Write unsaved drafts to localStorage now. Call when the page is hidden. */
  persistDrafts(): void
  /**
   * Take over from a read that finished late (see `SavedSession.late`):
   * learn what is stored, then carry out the latest writes held meanwhile.
   */
  adopt(session: Pick<SavedSession, 'storedFiles' | 'drafts'>): void
}

/**
 * @param session  The loaded session: its stored files are known to be in
 *                 IndexedDB as-is (so they are not rewritten), and its drafts
 *                 are kept until a save has caught up with them. If its read
 *                 is still running (`late`), writes wait for `adopt()`.
 */
export function createSessionWriter(
  session: Pick<SavedSession, 'storedFiles' | 'drafts' | 'late'>,
): SessionWriter {
  let saved = new Map(session.storedFiles.map((f) => [f.id, f]))
  const drafts = new Map(session.drafts)
  // Saves run one at a time, in order, each diffing against the last success.
  let queue: Promise<void> = Promise.resolve()

  // While the saved session is still being read, nothing is known about what
  // is stored, so writes are held. Only the latest of each kind matters.
  let waiting = session.late !== null
  let heldProject: { clear: true } | { clear: false; workspace: SavedWorkspace } | null = null
  let heldHistory: Explanation[] | null = null

  const enqueue = (label: string, work: (db: IDBDatabase) => Promise<void>) => {
    queue = queue
      .then(async () => work(await openDb()))
      .catch((err: unknown) => console.warn(`[lenscode] Could not save ${label}:`, err))
  }

  function writeWorkspace({ projectName, isExample, files, activeFileId }: SavedWorkspace) {
    enqueue('the project', async (db) => {
      const tx = db.transaction([FILES, META], 'readwrite')
      const store = tx.objectStore(FILES)
      const current = new Set(files.map((f) => f.id))
      for (const file of files) {
        if (saved.get(file.id) !== file) store.put(file)
      }
      for (const id of saved.keys()) {
        if (!current.has(id)) store.delete(id)
      }
      const record: ProjectRecord = {
        schema: SCHEMA,
        projectName,
        isExample,
        activeFileId,
        order: files.map((f) => f.id),
      }
      tx.objectStore(META).put(record, PROJECT_KEY)
      await completion(tx)
      saved = new Map(files.map((f) => [f.id, f]))
      // Drafts this save has caught up with (or whose file is gone) are done.
      let changed = false
      for (const [id, text] of drafts) {
        if (saved.get(id)?.content === text || !saved.has(id)) {
          drafts.delete(id)
          changed = true
        }
      }
      if (changed) writeDrafts(drafts)
    })
  }

  function clearStoredWorkspace() {
    drafts.clear()
    writeDrafts(drafts)
    enqueue('the project', async (db) => {
      const tx = db.transaction([FILES, META], 'readwrite')
      tx.objectStore(FILES).clear()
      tx.objectStore(META).delete(PROJECT_KEY)
      await completion(tx)
      saved = new Map()
    })
  }

  function writeHistory(history: Explanation[]) {
    enqueue('the history', async (db) => {
      const tx = db.transaction(META, 'readwrite')
      tx.objectStore(META).put(history, HISTORY_KEY)
      await completion(tx)
    })
  }

  return {
    saveWorkspace(workspace) {
      if (waiting) heldProject = { clear: false, workspace }
      else writeWorkspace(workspace)
    },

    clearWorkspace() {
      if (waiting) heldProject = { clear: true }
      else clearStoredWorkspace()
    },

    noteDraft(fileId, content) {
      drafts.set(fileId, content)
    },

    persistDrafts() {
      // Stored drafts belong to the session still being read; keep them.
      if (!waiting) writeDrafts(drafts)
    },

    saveHistory(history) {
      if (waiting) heldHistory = history
      else writeHistory(history)
    },

    adopt(late) {
      if (!waiting) return
      waiting = false
      saved = new Map(late.storedFiles.map((f) => [f.id, f]))
      for (const [id, text] of late.drafts) {
        if (!drafts.has(id)) drafts.set(id, text)
      }
      // Something was started or closed meanwhile: it replaces what was stored.
      if (heldProject?.clear) clearStoredWorkspace()
      else if (heldProject) writeWorkspace(heldProject.workspace)
      if (heldHistory) writeHistory(heldHistory)
      heldProject = null
      heldHistory = null
    },
  }
}
