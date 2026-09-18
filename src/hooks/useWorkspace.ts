import { useCallback, useMemo, useState } from 'react'
import { getLanguage } from '../data/languages'
import { STARTER_FILES } from '../data/starterFiles'
import type { LanguageId, WorkspaceFile } from '../types/workspace'

/**
 * In-memory workspace: a handful of files, one of which is open.
 * Nothing is persisted in this segment.
 */
export function useWorkspace() {
  const [files, setFiles] = useState<WorkspaceFile[]>(STARTER_FILES)
  const [activeFileId, setActiveFileId] = useState(STARTER_FILES[0].id)

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId],
  )

  const updateFile = useCallback((id: string, patch: Partial<WorkspaceFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }, [])

  const setContent = useCallback(
    (content: string) => updateFile(activeFile.id, { content }),
    [activeFile.id, updateFile],
  )

  const setLanguage = useCallback(
    (language: LanguageId) => updateFile(activeFile.id, { language }),
    [activeFile.id, updateFile],
  )

  const addFile = useCallback(
    (language: LanguageId = 'javascript') => {
      const ext = getLanguage(language).extension
      const untitled = files.filter((f) => f.name.startsWith('untitled')).length
      const suffix = untitled === 0 ? '' : `-${untitled + 1}`
      const file: WorkspaceFile = {
        id: `file_${Date.now()}`,
        name: `untitled${suffix}.${ext}`,
        language,
        content: '',
      }
      setFiles((prev) => [...prev, file])
      setActiveFileId(file.id)
    },
    [files],
  )

  return {
    files,
    activeFile,
    selectFile: setActiveFileId,
    setContent,
    setLanguage,
    addFile,
  }
}
