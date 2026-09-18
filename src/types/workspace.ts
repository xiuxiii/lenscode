export type LanguageId =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'

export interface LanguageDefinition {
  id: LanguageId
  label: string
  /** Default file extension, without the dot. */
  extension: string
  /** Short tag shown in compact UI (file icons, status bar). */
  tag: string
}

export interface WorkspaceFile {
  id: string
  name: string
  language: LanguageId
  content: string
}

/** The user's live selection inside the editor. */
export interface CodeSelection {
  text: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}
