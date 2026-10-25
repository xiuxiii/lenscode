/**
 * Reads files and folders the user opens (file picker, folder picker or
 * drag-and-drop) into plain `{ path, content }` records.
 *
 * Everything happens in the browser: nothing is uploaded. Only the code a
 * user later chooses to explain is sent to the API, so this module is also
 * the gate that keeps secrets and junk out of the workspace:
 *
 * - dependency / build / VCS folders (`node_modules`, `.git`, `dist`, …)
 * - binary files (images, fonts, archives, executables)
 * - secret files (`.env`, `.env.local`, private keys, credential files, …) — never read at all
 * - oversized files, and anything past the overall count / size caps
 */

export interface PickedFile {
  file: File
  /** '/'-separated path relative to what was picked, e.g. "repo/src/app.ts". */
  path: string
}

export interface ImportedFile {
  path: string
  content: string
}

export interface ImportSkips {
  /** Distinct ignored folder names that were present, e.g. ["node_modules", ".git"]. */
  folders: string[]
  /** Secret-looking files, by path. Never read. */
  secrets: string[]
  binary: number
  /** Files over the per-file size limit, by path. */
  tooLarge: string[]
  /** Files dropped because the count or total-size cap was reached. */
  overLimit: number
}

export interface ImportResult {
  files: ImportedFile[]
  /** The folder's name when exactly one folder was opened, else null. */
  rootName: string | null
  skipped: ImportSkips
}

/** Matches the server's limit on how much source one explanation may send. */
export const MAX_FILE_BYTES = 500_000
export const MAX_FILES = 2_000
const MAX_TOTAL_BYTES = 25_000_000
/** Stop walking a dropped folder after this many entries. */
const MAX_WALK_ENTRIES = 50_000
const READ_BATCH = 32

const IGNORED_FOLDERS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'bower_components', 'vendor',
  'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.output', '.vercel',
  '.turbo', '.cache', '.parcel-cache', '.vite', 'coverage', '.nyc_output',
  '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  '.tox', 'target', '.gradle', 'Pods', '.terraform', '.idea',
])

/** OS clutter, skipped without mention. */
const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

/** Private keys, keystores and credential stores (AWS, git, Postgres, Apache, Docker, Kubernetes). */
const SECRET_NAME =
  /^(id_(rsa|dsa|ecdsa|ed25519)|.*\.(pem|key|p12|pfx|jks|keystore|ppk|kdbx)|\.npmrc|\.pypirc|\.netrc|credentials|\.git-credentials|\.pgpass|\.htpasswd|\.dockercfg|kubeconfig(\.ya?ml)?)$/i
/** Config files that hold secrets: .env files, Terraform variables, cloud credentials, service accounts. */
const SECRET_CONFIG =
  /^(\.env(\..+)?|.*\.tfvars(\.json)?|secrets\..+|.*\.secrets?|(.+[-_])?credentials\.json|.*service[-_]?account.*\.json)$/i
/** Templates of those are safe to show and useful to explain: .env.example, secrets.sample.yaml. */
const SECRET_TEMPLATE = /\.(example|sample|template)(\.|$)|^\.env\.dist$/i
/** Docker and Kubernetes logins, matched on the path: a plain config.json is fine. */
const SECRET_PATH = /(^|\/)\.(docker\/config\.json|kube\/config)$/i

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'tif', 'tiff', 'avif', 'heic',
  'psd', 'ai', 'sketch', 'fig', 'pdf', 'zip', 'gz', 'tgz', 'rar', '7z', 'tar', 'bz2', 'xz',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'm4a', 'wav', 'ogg', 'flac', 'webm',
  'mov', 'avi', 'mkv', 'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'obj', 'class', 'jar',
  'war', 'pyc', 'pyo', 'wasm', 'db', 'sqlite', 'sqlite3', 'dmg', 'iso', 'apk', 'ipa',
])

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Whether the file at `path` (or a bare file name) holds keys or passwords. */
export function isSecretFile(path: string): boolean {
  const name = baseName(path)
  return (
    SECRET_NAME.test(name) ||
    (SECRET_CONFIG.test(name) && !SECRET_TEMPLATE.test(name)) ||
    SECRET_PATH.test(path)
  )
}

function isBinaryName(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && BINARY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

/** The ignored folder this path runs through, if any. */
function ignoredFolderIn(path: string): string | null {
  const parts = path.split('/')
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_FOLDERS.has(parts[i])) return parts[i]
  }
  return null
}

// ─────────────────────────── Sources ───────────────────────────

/** From `<input type="file">`, with or without `webkitdirectory`. */
export function pickedFromInput(list: FileList | null): PickedFile[] {
  return Array.from(list ?? [], (file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }))
}

function readEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader()
  const all: FileSystemEntry[] = []
  return new Promise((resolve, reject) => {
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all)
        all.push(...batch)
        next()
      }, reject)
    next()
  })
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

export interface DroppedItems {
  picked: PickedFile[]
  /** Ignored folders found while walking; their contents were never listed. */
  ignoredFolders: string[]
  /** True when exactly one folder (and nothing else) was dropped. */
  singleFolder: boolean
}

/**
 * From a drop event. Entries must be taken from the `DataTransfer`
 * synchronously, before any `await`, or the browser empties it — so call
 * this directly inside the `drop` handler.
 */
export function pickedFromDrop(data: DataTransfer): Promise<DroppedItems> {
  const roots = Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null)

  const singleFolder = roots.length === 1 && roots[0].isDirectory

  // No entry API for these items: fall back to the plain file list (no folders).
  if (roots.length === 0) {
    const picked = Array.from(data.files, (file) => ({ file, path: file.name }))
    return Promise.resolve({ picked, ignoredFolders: [], singleFolder: false })
  }

  return (async () => {
    const picked: PickedFile[] = []
    const ignored = new Set<string>()
    let seen = 0

    const walk = async (entry: FileSystemEntry): Promise<void> => {
      if (++seen > MAX_WALK_ENTRIES) return
      if (entry.isDirectory && IGNORED_FOLDERS.has(entry.name)) {
        ignored.add(entry.name)
        return
      }
      if (entry.isDirectory) {
        for (const child of await readEntries(entry as FileSystemDirectoryEntry)) {
          await walk(child)
        }
      } else if (entry.isFile) {
        picked.push({
          file: await entryFile(entry as FileSystemFileEntry),
          path: entry.fullPath.replace(/^\/+/, ''),
        })
      }
    }

    for (const root of roots) await walk(root)
    return { picked, ignoredFolders: [...ignored], singleFolder }
  })()
}

// ─────────────────────────── Reading ───────────────────────────

/** The shared first folder of every path, when there is one. */
function commonRoot(paths: string[]): string | null {
  if (paths.length === 0 || !paths.every((p) => p.includes('/'))) return null
  const first = paths[0].slice(0, paths[0].indexOf('/'))
  return paths.every((p) => p.startsWith(`${first}/`)) ? first : null
}

export async function readPickedFiles(
  picked: PickedFile[],
  options: { asFolder: boolean; ignoredFolders?: string[] },
): Promise<ImportResult> {
  const skipped: ImportSkips = {
    folders: [],
    secrets: [],
    binary: 0,
    tooLarge: [],
    overLimit: 0,
  }
  const ignored = new Set(options.ignoredFolders ?? [])

  const root = options.asFolder ? commonRoot(picked.map((p) => p.path)) : null
  const strip = (path: string) => (root ? path.slice(root.length + 1) : path)

  const accepted: PickedFile[] = []
  let totalBytes = 0
  for (const item of [...picked].sort((a, b) => a.path.localeCompare(b.path))) {
    const path = strip(item.path)
    const name = baseName(path)
    const folder = ignoredFolderIn(path)
    if (folder) {
      ignored.add(folder)
      continue
    }
    if (JUNK_FILES.has(name)) continue
    // The full path, so `.docker/config.json` is caught even when `.docker` was the folder opened.
    if (isSecretFile(item.path)) {
      skipped.secrets.push(path)
      continue
    }
    if (isBinaryName(name)) {
      skipped.binary++
      continue
    }
    if (item.file.size > MAX_FILE_BYTES) {
      skipped.tooLarge.push(path)
      continue
    }
    if (accepted.length >= MAX_FILES || totalBytes + item.file.size > MAX_TOTAL_BYTES) {
      skipped.overLimit++
      continue
    }
    totalBytes += item.file.size
    accepted.push({ file: item.file, path })
  }

  const files: ImportedFile[] = []
  for (let i = 0; i < accepted.length; i += READ_BATCH) {
    const batch = accepted.slice(i, i + READ_BATCH)
    const contents = await Promise.all(
      batch.map((item) => item.file.text().catch(() => null)),
    )
    batch.forEach((item, j) => {
      const content = contents[j]
      // Unreadable, or a NUL byte early on: treat as binary.
      if (content === null || content.slice(0, 8_000).includes('\u0000')) {
        skipped.binary++
        return
      }
      files.push({ path: item.path, content })
    })
  }

  skipped.folders = [...ignored].sort()
  return { files, rootName: root, skipped }
}
