import { useCallback, useMemo, useRef, useState } from 'react'
import { DEFAULT_PROJECT_NAME, STARTER_FILES } from '../data/starterFiles'
import { detectLanguage } from '../lib/detectLanguage'
import type { ImportedFile } from '../lib/importFiles'
import type { SavedWorkspace } from '../lib/sessionStore'
import type { WorkspaceFile } from '../types/workspace'

/**
 * The workspace: a project name and its files, one of which is open.
 * It starts from the session saved in this browser, if any (see
 * `sessionStore`), and is saved again by `useSessionPersistence`.
 *
 * A file's language is never chosen by hand: it is detected from the content
 * when the file is opened and re-detected on every edit (see `detectLanguage`).
 */

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** The file to show first in a freshly opened folder. */
function pickInitialFile(files: WorkspaceFile[]): WorkspaceFile {
  const topLevel = files.filter((f) => !f.path.includes('/'))
  return (
    topLevel.find((f) => /^readme(\.md)?$/i.test(f.name)) ??
    topLevel.find((f) => f.language !== 'plaintext') ??
    files.find((f) => f.language !== 'plaintext') ??
    files[0]
  )
}

/** A fresh copy of the example project. New ids, so no stale editor models. */
function exampleWorkspace(): SavedWorkspace {
  const stamp = Date.now()
  const files = STARTER_FILES.map((f) => ({ ...f, id: `${f.id}_${stamp}` }))
  return {
    projectName: DEFAULT_PROJECT_NAME,
    isExample: true,
    files,
    activeFileId: files[0].id,
  }
}

export function useWorkspace(initial: SavedWorkspace | null) {
  const [start] = useState(() => initial ?? exampleWorkspace())
  const [projectName, setProjectName] = useState(start.projectName)
  const [isExample, setIsExample] = useState(start.isExample)
  const [files, setFiles] = useState<WorkspaceFile[]>(start.files)
  const [activeFileId, setActiveFileId] = useState(start.activeFileId)
  const nextId = useRef(0)

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId],
  )

  const toWorkspaceFile = useCallback(
    ({ path, content }: ImportedFile): WorkspaceFile => {
      const name = baseName(path)
      return {
        id: `file_${Date.now()}_${nextId.current++}`,
        name,
        path,
        content,
        language: detectLanguage(content, { fileName: name }),
      }
    },
    [],
  )

  const setContent = useCallback(
    (content: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFile.id
            ? {
                ...f,
                content,
                language: detectLanguage(content, { fileName: f.name, current: f.language }),
              }
            : f,
        ),
      )
    },
    [activeFile.id],
  )

  const addFile = useCallback(() => {
    const untitled = files.filter((f) => f.name.startsWith('untitled')).length
    // No extension: the language comes from whatever gets pasted in.
    const name = untitled === 0 ? 'untitled' : `untitled-${untitled + 1}`
    const file: WorkspaceFile = {
      id: `file_${Date.now()}_${nextId.current++}`,
      name,
      path: name,
      language: 'plaintext',
      content: '',
    }
    setFiles((prev) => [...prev, file])
    setActiveFileId(file.id)
  }, [files])

  /** Replace the whole project with an opened folder. */
  const openFolder = useCallback(
    (name: string, imported: ImportedFile[]) => {
      if (imported.length === 0) return
      const opened = imported.map(toWorkspaceFile)
      setProjectName(name)
      setIsExample(false)
      setFiles(opened)
      setActiveFileId(pickInitialFile(opened).id)
    },
    [toWorkspaceFile],
  )

  /**
   * Add individual files to the current project. Re-opening a file that is
   * already there (same path) refreshes its content instead of duplicating it.
   */
  const addFiles = useCallback(
    (imported: ImportedFile[]) => {
      if (imported.length === 0) return
      const byPath = new Map(files.map((f) => [f.path, f]))
      const updated = new Map<string, WorkspaceFile>()
      const added: WorkspaceFile[] = []
      for (const item of imported) {
        const existing = byPath.get(item.path)
        if (existing) {
          updated.set(existing.id, {
            ...existing,
            content: item.content,
            language: detectLanguage(item.content, { fileName: existing.name }),
          })
        } else {
          added.push(toWorkspaceFile(item))
        }
      }
      setFiles((prev) => [...prev.map((f) => updated.get(f.id) ?? f), ...added])
      setActiveFileId(added[0]?.id ?? byPath.get(imported[0].path)!.id)
    },
    [files, toWorkspaceFile],
  )

  /** Go back to a fresh example project (also how the example is reset). */
  const closeProject = useCallback(() => {
    const example = exampleWorkspace()
    setProjectName(example.projectName)
    setIsExample(true)
    setFiles(example.files)
    setActiveFileId(example.activeFileId)
  }, [])

  return {
    projectName,
    isExample,
    files,
    activeFile,
    activeFileId: activeFile.id,
    selectFile: setActiveFileId,
    setContent,
    addFile,
    openFolder,
    addFiles,
    closeProject,
  }
}
