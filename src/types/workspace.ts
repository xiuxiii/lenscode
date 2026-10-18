export type LanguageId =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'shell'
  | 'powershell'
  | 'sql'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'yaml'
  | 'markdown'
  | 'dockerfile'
  /** Not recognised (yet) — empty files, prose, or too little code to tell. */
  | 'plaintext'

export interface LanguageDefinition {
  id: LanguageId
  label: string
  /** One plain-English line for someone who has never heard of it. */
  description: string
}

export interface WorkspaceFile {
  id: string
  /** File name only, e.g. "app.ts". */
  name: string
  /** Unique '/'-separated path inside the project, e.g. "src/app.ts". */
  path: string
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
