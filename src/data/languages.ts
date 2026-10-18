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
    color: '#f2c94c',
    label: 'JavaScript',
    extension: 'js',
    tag: 'JS',
    description: 'The language of the web. It runs in browsers and in Node.js.',
  },
  {
    id: 'typescript',
    color: '#6ea8fe',
    label: 'TypeScript',
    extension: 'ts',
    tag: 'TS',
    description: 'JavaScript with type labels that catch mistakes before the code runs.',
  },
  {
    id: 'python',
    color: '#7fd1a0',
    label: 'Python',
    extension: 'py',
    tag: 'PY',
    description: 'A general-purpose language known for readable code, popular for scripts, data and AI.',
  },
  {
    id: 'html',
    color: '#f28b6b',
    label: 'HTML',
    extension: 'html',
    tag: 'HTML',
    description: 'Describes the structure and content of a web page.',
  },
  {
    id: 'css',
    color: '#c792ea',
    label: 'CSS',
    extension: 'css',
    tag: 'CSS',
    description: 'Controls how a web page looks: colours, sizes and layout.',
  },
  {
    id: 'json',
    color: '#9aa4b2',
    label: 'JSON',
    extension: 'json',
    tag: 'JSON',
    description: 'A plain-text format for storing and sending data.',
  },
  {
    id: 'shell',
    color: '#8bd5ca',
    label: 'Terminal command',
    phrase: 'a terminal command',
    extension: 'sh',
    tag: 'SH',
    description: 'Commands you type into a terminal (Bash/Zsh) to run programs, manage files, or use tools like git and npm.',
  },
  {
    id: 'powershell',
    color: '#5aa9e6',
    label: 'PowerShell',
    extension: 'ps1',
    tag: 'PS',
    description: 'The Windows terminal language for running commands and scripts.',
  },
  {
    id: 'sql',
    color: '#e8a87c',
    label: 'SQL',
    extension: 'sql',
    tag: 'SQL',
    description: 'The language for reading and changing data in a database.',
  },
  {
    id: 'java',
    color: '#e76f51',
    label: 'Java',
    extension: 'java',
    tag: 'JAVA',
    description: 'A general-purpose language used for Android apps and large back-end systems.',
  },
  {
    id: 'c',
    color: '#8fa8c8',
    label: 'C',
    extension: 'c',
    tag: 'C',
    description: 'A low-level language that works close to the hardware; many other languages are built on it.',
  },
  {
    id: 'cpp',
    color: '#6c9bd2',
    label: 'C++',
    extension: 'cpp',
    tag: 'C++',
    description: 'C with extra features, used for games, browsers and other fast software.',
  },
  {
    id: 'csharp',
    color: '#a37acc',
    label: 'C#',
    extension: 'cs',
    tag: 'C#',
    description: "Microsoft's general-purpose language, used for Windows apps and Unity games.",
  },
  {
    id: 'go',
    color: '#5fd3e8',
    label: 'Go',
    extension: 'go',
    tag: 'GO',
    description: "Google's language for fast, simple servers and command-line tools.",
  },
  {
    id: 'rust',
    color: '#e09f6b',
    label: 'Rust',
    extension: 'rs',
    tag: 'RS',
    description: 'A fast systems language designed to prevent memory bugs.',
  },
  {
    id: 'php',
    color: '#8892c6',
    label: 'PHP',
    extension: 'php',
    tag: 'PHP',
    description: 'A server-side language that builds web pages; WordPress is written in it.',
  },
  {
    id: 'ruby',
    color: '#e5636b',
    label: 'Ruby',
    extension: 'rb',
    tag: 'RB',
    description: 'A readable scripting language, best known for the Rails web framework.',
  },
  {
    id: 'yaml',
    color: '#c3c97a',
    label: 'YAML',
    extension: 'yml',
    tag: 'YML',
    description: 'A plain-text format for configuration files, such as CI pipelines and Docker Compose.',
  },
  {
    id: 'markdown',
    color: '#b8c0cc',
    label: 'Markdown',
    extension: 'md',
    tag: 'MD',
    description: 'Plain text with simple symbols for headings, lists and links, used for READMEs.',
  },
  {
    id: 'dockerfile',
    color: '#4fa3e0',
    label: 'Dockerfile',
    phrase: 'a Dockerfile',
    extension: 'dockerfile',
    tag: 'DOCK',
    description: 'Step-by-step instructions for building a Docker container image.',
  },
  {
    id: 'plaintext',
    color: '#626c7a',
    label: 'Not detected yet',
    extension: 'txt',
    tag: 'TXT',
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
