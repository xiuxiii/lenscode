import { useCallback, useMemo, useRef, useState } from 'react'
import { DEFAULT_PROJECT_NAME, STARTER_FILES } from '../data/starterFiles'
import { detectLanguage } from '../lib/detectLanguage'
import type { ImportedFile } from '../lib/importFiles'
import type { WorkspaceFile } from '../types/workspace'

/**
 * In-memory workspace: a project name and its files, one of which is open.
 * Nothing is persisted in this segment.
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

export function useWorkspace() {
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME)
  const [files, setFiles] = useState<WorkspaceFile[]>(STARTER_FILES)
  const [activeFileId, setActiveFileId] = useState(STARTER_FILES[0].id)
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

  return {
    projectName,
    files,
    activeFile,
    selectFile: setActiveFileId,
    setContent,
    addFile,
    openFolder,
    addFiles,
  }
}
