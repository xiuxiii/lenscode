import type { LanguageDefinition, LanguageId } from '../types/workspace.ts'

/**
 * Every language LensCode recognises. The `id` doubles as the Monaco
 * language id, so syntax highlighting works for all of them.
 *
 * Languages are never chosen by the user: `detectLanguage()` picks one from
 * the code itself. `description` is shown next to the name for people who
 * have never heard of the language.
 */
export const LANGUAGES: LanguageDefinition[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    description: 'The language of the web. It runs in browsers and in Node.js.',
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    description: 'JavaScript with type labels that catch mistakes before the code runs.',
  },
  {
    id: 'python',
    label: 'Python',
    description: 'A general-purpose language known for readable code, popular for scripts, data and AI.',
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'Describes the structure and content of a web page.',
  },
  {
    id: 'css',
    label: 'CSS',
    description: 'Controls how a web page looks: colours, sizes and layout.',
  },
  {
    id: 'json',
    label: 'JSON',
    description: 'A plain-text format for storing and sending data.',
  },
  {
    id: 'shell',
    label: 'Terminal command',
    description: 'Commands you type into a terminal (Bash/Zsh) to run programs, manage files, or use tools like git and npm.',
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    description: 'The Windows terminal language for running commands and scripts.',
  },
  {
    id: 'sql',
    label: 'SQL',
    description: 'The language for reading and changing data in a database.',
  },
  {
    id: 'java',
    label: 'Java',
    description: 'A general-purpose language used for Android apps and large back-end systems.',
  },
  {
    id: 'c',
    label: 'C',
    description: 'A low-level language that works close to the hardware; many other languages are built on it.',
  },
  {
    id: 'cpp',
    label: 'C++',
    description: 'C with extra features, used for games, browsers and other fast software.',
  },
  {
    id: 'csharp',
    label: 'C#',
    description: "Microsoft's general-purpose language, used for Windows apps and Unity games.",
  },
  {
    id: 'go',
    label: 'Go',
    description: "Google's language for fast, simple servers and command-line tools.",
  },
  {
    id: 'rust',
    label: 'Rust',
    description: 'A fast systems language designed to prevent memory bugs.',
  },
  {
    id: 'php',
    label: 'PHP',
    description: 'A server-side language that builds web pages; WordPress is written in it.',
  },
  {
    id: 'ruby',
    label: 'Ruby',
    description: 'A readable scripting language, best known for the Rails web framework.',
  },
  {
    id: 'yaml',
    label: 'YAML',
    description: 'A plain-text format for configuration files, such as CI pipelines and Docker Compose.',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Plain text with simple symbols for headings, lists and links, used for READMEs.',
  },
  {
    id: 'dockerfile',
    label: 'Dockerfile',
    description: 'Step-by-step instructions for building a Docker container image.',
  },
  {
    id: 'plaintext',
    label: 'Not detected yet',
    description: 'Paste or type some code and LensCode will work out the language automatically.',
  },
]

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]))

export function getLanguage(id: LanguageId): LanguageDefinition {
  return BY_ID.get(id) ?? BY_ID.get('plaintext')!
}

const BY_EXTENSION: Record<string, LanguageId> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'json',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  dockerfile: 'dockerfile',
}

/** The language a file name implies, or `null` when it implies none. */
export function languageFromFileName(name: string): LanguageId | null {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile'
  if (!lower.includes('.')) return null
  return BY_EXTENSION[lower.split('.').pop() ?? ''] ?? null
}
