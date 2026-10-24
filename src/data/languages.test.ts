import { describe, expect, it } from 'vitest'
import { getLanguage, LANGUAGES, languageFromFileName } from './languages'

describe('LANGUAGES', () => {
  it('has unique ids', () => {
    const ids = LANGUAGES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every language a label and a beginner description', () => {
    for (const language of LANGUAGES) {
      expect(language.label.trim(), language.id).not.toBe('')
      expect(language.description.trim(), language.id).not.toBe('')
    }
  })

  it('includes plaintext, the fallback for unknown code', () => {
    expect(LANGUAGES.some((l) => l.id === 'plaintext')).toBe(true)
  })
})

describe('getLanguage', () => {
  it('finds a language by id', () => {
    expect(getLanguage('python').label).toBe('Python')
  })

  it('falls back to plaintext for an unknown id', () => {
    // An id from an older saved session, say.
    expect(getLanguage('cobol' as never).id).toBe('plaintext')
  })
})

describe('languageFromFileName', () => {
  it.each([
    ['app.js', 'javascript'],
    ['server.mjs', 'javascript'],
    ['App.jsx', 'javascript'],
    ['api.ts', 'typescript'],
    ['App.tsx', 'typescript'],
    ['main.py', 'python'],
    ['index.html', 'html'],
    ['styles.css', 'css'],
    ['package.json', 'json'],
    ['setup.sh', 'shell'],
    ['profile.ps1', 'powershell'],
    ['schema.sql', 'sql'],
    ['Main.java', 'java'],
    ['main.c', 'c'],
    ['util.h', 'c'],
    ['main.cpp', 'cpp'],
    ['Program.cs', 'csharp'],
    ['main.go', 'go'],
    ['main.rs', 'rust'],
    ['index.php', 'php'],
    ['app.rb', 'ruby'],
    ['ci.yml', 'yaml'],
    ['compose.yaml', 'yaml'],
    ['README.md', 'markdown'],
    ['Dockerfile', 'dockerfile'],
    ['Dockerfile.dev', 'dockerfile'],
    ['web.dockerfile', 'dockerfile'],
  ])('%s → %s', (name, expected) => {
    expect(languageFromFileName(name)).toBe(expected)
  })

  it('ignores case', () => {
    expect(languageFromFileName('MAIN.PY')).toBe('python')
    expect(languageFromFileName('dockerfile')).toBe('dockerfile')
  })

  it('uses the last extension', () => {
    expect(languageFromFileName('config.test.ts')).toBe('typescript')
  })

  it('returns null for names that imply no language', () => {
    expect(languageFromFileName('untitled')).toBeNull()
    expect(languageFromFileName('Makefile')).toBeNull()
    expect(languageFromFileName('notes.txt')).toBeNull()
    expect(languageFromFileName('archive.')).toBeNull()
  })
})
