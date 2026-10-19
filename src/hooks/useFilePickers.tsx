import { useRef, type ReactNode } from 'react'
import { pickedFromInput, type PickedFile } from '../lib/importFiles'

/**
 * The browser's folder and file pickers, opened from any button. Render
 * `inputs` once (they are hidden); `pickFolder` / `pickFiles` open them.
 */
export function useFilePickers(
  onFolder: (picked: PickedFile[]) => void,
  onFiles: (picked: PickedFile[]) => void,
): { pickFolder: () => void; pickFiles: () => void; inputs: ReactNode } {
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)

  const inputs = (
    <>
      <input
        ref={(el) => {
          folderInput.current = el
          // Not in React's types; enables folder picking in every major browser.
          el?.setAttribute('webkitdirectory', '')
        }}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onFolder(pickedFromInput(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        ref={filesInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onFiles(pickedFromInput(e.target.files))
          e.target.value = ''
        }}
      />
    </>
  )

  return {
    pickFolder: () => folderInput.current?.click(),
    pickFiles: () => filesInput.current?.click(),
    inputs,
  }
}
