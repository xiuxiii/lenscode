import { describe, expect, it } from 'vitest'
import type { LanguageId } from '../types/workspace'
import { detectLanguage, scoreLanguages } from './detectLanguage'

/**
 * Snippets a beginner might paste, each with the language it must be
 * detected as from the content alone (no file name).
 */
const CORPUS: [name: string, expected: LanguageId, code: string][] = [
  // ── Terminal commands ──
  ['npm install', 'shell', 'npm install'],
  ['git clone and cd', 'shell', 'git clone https://github.com/user/repo.git\ncd repo'],
  ['setup steps', 'shell', 'npm install\ncp .env.example .env.local\nnpm run dev'],
  ['prompt-prefixed command', 'shell', '$ npx create-react-app my-app'],
  ['sudo apt', 'shell', 'sudo apt-get update\nsudo apt-get install -y curl'],
  ['brew install', 'shell', 'brew install node'],
  ['pipe to grep', 'shell', 'ps aux | grep node'],
  ['export variable', 'shell', 'export PATH="$HOME/.local/bin:$PATH"'],
  ['shebang script', 'shell', '#!/bin/bash\nset -e\necho "Deploying"\n./build.sh'],
  [
    'shell if block',
    'shell',
    'if [ -f .env ]; then\n  source .env\nfi\nfor f in *.txt; do\n  echo "$f"\ndone',
  ],
  ['docker run', 'shell', 'docker run -p 3000:3000 my-app'],
  ['git push upstream', 'shell', 'git checkout -b my-feature\ngit push -u origin my-feature'],
  ['pip install', 'shell', 'pip install requests'],
  ['curl with flags', 'shell', 'curl -fsSL https://example.com/install.sh | sh'],
  ['rm -rf', 'shell', 'rm -rf node_modules\nnpm install'],

  // ── PowerShell ──
  ['Get-ChildItem', 'powershell', 'Get-ChildItem -Path C:\\Users -Recurse'],
  ['env var', 'powershell', '$env:NODE_ENV = "production"\nWrite-Host "Set"'],
  ['Remove-Item force', 'powershell', 'Remove-Item -Path .\\dist -Recurse -Force'],

  // ── JavaScript ──
  ['console.log', 'javascript', 'console.log("hello")'],
  [
    'fetch with await',
    'javascript',
    'async function fetchUsers() {\n  const response = await fetch("/api/users");\n  const data = await response.json();\n  return data;\n}',
  ],
  ['arrow function', 'javascript', 'const add = (a, b) => a + b;'],
  ['require', 'javascript', "const express = require('express');\nconst app = express();"],
  [
    'DOM query',
    'javascript',
    "document.querySelector('#btn').addEventListener('click', () => {\n  alert('hi');\n});",
  ],
  ['array methods', 'javascript', 'const names = users.map((u) => u.name).filter(Boolean);'],
  [
    'module exports',
    'javascript',
    'function greet(name) {\n  return `Hello, ${name}`;\n}\nmodule.exports = { greet };',
  ],

  // ── TypeScript ──
  [
    'interface',
    'typescript',
    'export interface User {\n  id: number;\n  name: string;\n  email: string;\n}',
  ],
  [
    'typed function',
    'typescript',
    'export async function getUsers(): Promise<User[]> {\n  const response = await fetch("/api/users");\n  return response.json();\n}',
  ],
  ['type alias', 'typescript', "type Status = 'idle' | 'loading' | 'done';\nlet s: Status = 'idle';"],
  [
    'class with private field',
    'typescript',
    'class Counter {\n  private count: number = 0;\n  increment(): void {\n    this.count++;\n  }\n}',
  ],

  // ── Python ──
  ['print', 'python', 'print("Hello, world")'],
  [
    'def with loop',
    'python',
    'def fetch_users():\n    response = requests.get(URL)\n    for user in response.json():\n        print(user["name"])',
  ],
  ['from import', 'python', 'from flask import Flask, jsonify\napp = Flask(__name__)'],
  [
    'class',
    'python',
    'class Dog:\n    def __init__(self, name):\n        self.name = name\n\n    def bark(self):\n        return f"{self.name} says woof"',
  ],
  ['main guard', 'python', 'if __name__ == "__main__":\n    main()'],
  ['list comprehension', 'python', 'squares = [x * x for x in range(10)]\nprint(squares)'],

  // ── HTML ──
  [
    'document',
    'html',
    '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <title>Hi</title>\n  </head>\n  <body></body>\n</html>',
  ],
  ['div with class', 'html', '<div class="card">\n  <h1>Title</h1>\n  <p>Body</p>\n</div>'],
  ['form', 'html', '<form action="/login" method="post">\n  <input type="text" name="user">\n  <button>Log in</button>\n</form>'],

  // ── CSS ──
  ['rule', 'css', '.container {\n  display: flex;\n  gap: 12px;\n  padding: 24px;\n}'],
  ['variables', 'css', ':root {\n  --accent: #4f7cff;\n}\n\nh1 {\n  color: var(--accent);\n}'],
  ['media query', 'css', '@media (max-width: 600px) {\n  .nav {\n    display: none;\n  }\n}'],

  // ── JSON ──
  ['package.json', 'json', '{\n  "name": "app",\n  "version": "1.0.0",\n  "scripts": { "dev": "vite" }\n}'],
  ['array of objects', 'json', '[\n  { "id": 1, "name": "Ada" },\n  { "id": 2, "name": "Linus" }\n]'],

  // ── SQL ──
  ['select', 'sql', 'SELECT name, email FROM users WHERE active = 1 ORDER BY name;'],
  [
    'create table',
    'sql',
    'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);',
  ],
  ['insert', 'sql', "INSERT INTO users (name, email) VALUES ('Ada', 'ada@example.com');"],
  ['join', 'sql', 'SELECT o.id, u.name\nFROM orders o\nJOIN users u ON u.id = o.user_id;'],

  // ── Java ──
  [
    'main class',
    'java',
    'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}',
  ],
  [
    'ArrayList',
    'java',
    'import java.util.ArrayList;\n\nList<String> names = new ArrayList<>();\nnames.add("Ada");',
  ],

  // ── C ──
  [
    'hello world',
    'c',
    '#include <stdio.h>\n\nint main(void) {\n    printf("Hello\\n");\n    return 0;\n}',
  ],
  ['malloc', 'c', '#include <stdlib.h>\nint *nums = malloc(10 * sizeof(int));\nfree(nums);'],

  // ── C++ ──
  [
    'iostream',
    'cpp',
    '#include <iostream>\n\nint main() {\n    std::cout << "Hello" << std::endl;\n    return 0;\n}',
  ],
  ['vector', 'cpp', '#include <vector>\nstd::vector<int> nums = {1, 2, 3};\nfor (auto n : nums) {}'],

  // ── C# ──
  [
    'console app',
    'csharp',
    'using System;\n\nnamespace Hello {\n    class Program {\n        static void Main(string[] args) {\n            Console.WriteLine("Hi");\n        }\n    }\n}',
  ],
  [
    'property',
    'csharp',
    'public class User\n{\n    public string Name { get; set; }\n}',
  ],

  // ── Go ──
  [
    'hello world',
    'go',
    'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello")\n}',
  ],
  ['short declaration', 'go', 'func add(a int, b int) int {\n    total := a + b\n    return total\n}'],
  ['error check', 'go', 'data, err := os.ReadFile("a.txt")\nif err != nil {\n    return err\n}'],

  // ── Rust ──
  ['hello world', 'rust', 'fn main() {\n    println!("Hello");\n}'],
  ['let mut', 'rust', 'let mut count = 0;\ncount += 1;\nprintln!("{}", count);'],
  [
    'struct impl',
    'rust',
    'struct User {\n    name: String,\n}\n\nimpl User {\n    fn greet(&self) -> String {\n        format!("Hi {}", self.name)\n    }\n}',
  ],

  // ── PHP ──
  ['echo', 'php', '<?php\necho "Hello";\n?>'],
  ['variables', 'php', '<?php\n$name = "Ada";\n$users = [];\nforeach ($users as $user) {\n    echo $user;\n}'],

  // ── Ruby ──
  ['puts', 'ruby', 'puts "Hello"'],
  ['def end', 'ruby', 'def greet(name)\n  puts "Hi #{name}"\nend'],
  [
    'class with attr',
    'ruby',
    'class Dog\n  attr_reader :name\n\n  def initialize(name)\n    @name = name\n  end\nend',
  ],
  ['each block', 'ruby', '[1, 2, 3].each do |n|\n  puts n\nend'],

  // ── YAML ──
  [
    'GitHub workflow',
    'yaml',
    'name: CI\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4',
  ],
  ['compose file', 'yaml', 'services:\n  web:\n    image: nginx\n    ports:\n      - "80:80"'],

  // ── Markdown ──
  ['readme', 'markdown', '# My Project\n\nA short description.\n\n## Install\n\n- Clone it\n- Run it'],
  ['link and bold', 'markdown', '## Usage\n\nSee the [docs](https://example.com) for **details**.'],

  // ── Dockerfile ──
  [
    'node image',
    'dockerfile',
    'FROM node:20\nWORKDIR /app\nCOPY package.json .\nRUN npm install\nCOPY . .\nCMD ["npm", "start"]',
  ],
  ['python image', 'dockerfile', 'FROM python:3.12-slim\nRUN pip install flask\nEXPOSE 5000'],
]

describe('detectLanguage: corpus', () => {
  it.each(CORPUS)('%s → %s', (_name, expected, code) => {
    expect(detectLanguage(code)).toBe(expected)
  })
})

describe('detectLanguage: options and edge cases', () => {
  it('reports plaintext for empty or whitespace-only content', () => {
    expect(detectLanguage('')).toBe('plaintext')
    expect(detectLanguage('   \n\t ')).toBe('plaintext')
  })

  it('uses the file extension for an empty file', () => {
    expect(detectLanguage('', { fileName: 'app.py' })).toBe('python')
    expect(detectLanguage('', { fileName: 'Dockerfile' })).toBe('dockerfile')
  })

  it('reports plaintext for prose with no code in it', () => {
    expect(detectLanguage('Remember to buy milk tomorrow')).toBe('plaintext')
  })

  it('lets strong evidence override the file extension', () => {
    const python = 'def main():\n    print("hi")\n\nif __name__ == "__main__":\n    main()'
    expect(detectLanguage(python, { fileName: 'notes.js' })).toBe('python')
  })

  it('uses the extension to break a tie', () => {
    // C and C++ score the same here; the file name decides.
    const code = '#include <stdio.h>\nint main() { return 0; }'
    expect(detectLanguage(code, { fileName: 'x.c' })).toBe('c')
    expect(detectLanguage(code, { fileName: 'x.cpp' })).toBe('cpp')
  })

  it('lets the extension tip a close call', () => {
    // `echo` looks like a shell command, but this is a PHP file.
    expect(detectLanguage('echo "hi"', { fileName: 'a.php' })).toBe('php')
    expect(detectLanguage('echo "hi"')).toBe('shell')
  })

  it('keeps the current language when there is too little evidence', () => {
    expect(detectLanguage('x', { current: 'python' })).toBe('python')
  })

  it('ignores a current language of plaintext', () => {
    expect(detectLanguage('console.log(1)', { current: 'plaintext' })).toBe('javascript')
  })

  it('does not flip on a single ambiguous line while typing', () => {
    // A Python file being edited: a lone assignment stays Python.
    expect(detectLanguage('total = 0', { current: 'python', fileName: 'app.py' })).toBe('python')
  })

  it('only inspects the start of very large files', () => {
    const python = 'def f():\n    return 1\n'.repeat(10)
    const tail = '\nconsole.log(1);'.repeat(10_000)
    expect(detectLanguage(python + tail)).toBe('python')
  })

  it('stays quick on a long line with no spaces, like minified code', () => {
    const start = performance.now()
    detectLanguage('x'.repeat(8_000))
    expect(performance.now() - start).toBeLessThan(1_000)
  })
})

describe('scoreLanguages', () => {
  it('scores TypeScript as JavaScript plus TypeScript-only markers', () => {
    const scores = scoreLanguages('const x: number = 1;\nconsole.log(x);')
    expect(scores.get('typescript')!).toBeGreaterThan(scores.get('javascript')!)
  })

  it('gives a valid JSON document a large boost', () => {
    const scores = scoreLanguages('{"a": 1}')
    expect(scores.get('json')).toBeGreaterThanOrEqual(12)
  })

  it('does not boost JSON for text that only looks like it', () => {
    const scores = scoreLanguages('{ a: 1 }')
    expect(scores.get('json') ?? 0).toBeLessThan(12)
  })
})
