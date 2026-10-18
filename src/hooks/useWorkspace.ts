import { useCallback, useMemo, useState } from 'react'
import { STARTER_FILES } from '../data/starterFiles'
import { detectLanguage } from '../lib/detectLanguage'
import type { WorkspaceFile } from '../types/workspace'

/**
 * In-memory workspace: a handful of files, one of which is open.
 * Nothing is persisted in this segment.
 *
 * A file's language is never chosen by hand: it is re-detected from the
 * content on every edit (see `detectLanguage`).
 */
export function useWorkspace() {
  const [files, setFiles] = useState<WorkspaceFile[]>(STARTER_FILES)
  const [activeFileId, setActiveFileId] = useState(STARTER_FILES[0].id)

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId],
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
    const file: WorkspaceFile = {
      id: `file_${Date.now()}`,
      // No extension: the language comes from whatever gets pasted in.
      name: untitled === 0 ? 'untitled' : `untitled-${untitled + 1}`,
      language: 'plaintext',
      content: '',
    }
    setFiles((prev) => [...prev, file])
    setActiveFileId(file.id)
  }, [files])

  return {
    files,
    activeFile,
    selectFile: setActiveFileId,
    setContent,
    addFile,
  }
}
