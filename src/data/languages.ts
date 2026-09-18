import type { LanguageDefinition, LanguageId } from '../types/workspace'

export const LANGUAGES: LanguageDefinition[] = [
  { id: 'javascript', label: 'JavaScript', extension: 'js', tag: 'JS' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts', tag: 'TS' },
  { id: 'python', label: 'Python', extension: 'py', tag: 'PY' },
  { id: 'html', label: 'HTML', extension: 'html', tag: 'HTML' },
  { id: 'css', label: 'CSS', extension: 'css', tag: 'CSS' },
  { id: 'json', label: 'JSON', extension: 'json', tag: 'JSON' },
]

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]))

export function getLanguage(id: LanguageId): LanguageDefinition {
  return BY_ID.get(id) ?? LANGUAGES[0]
}

export function languageFromFileName(name: string): LanguageId {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'py':
      return 'python'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    case 'json':
      return 'json'
    default:
      return 'javascript'
  }
}
