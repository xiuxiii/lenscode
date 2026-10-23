import type { WorkspaceFile } from '../types/workspace'

/**
 * The tutorial project, opened from the start screen: a short guide and a
 * few small, realistic files to practise on.
 */
export const STARTER_FILES: WorkspaceFile[] = [
  {
    id: 'start-here-md',
    name: 'START-HERE.md',
    path: 'START-HERE.md',
    language: 'markdown',
    content: `# Welcome to the LensCode tutorial

This is a small practice project. None of it is yours, so explore freely and
change anything you like: "Restart tutorial" on the start screen brings it back.

## 1. Highlight something

Open fetchUsers.js from the Files list and drag across the word \`await\`
(or just double-click it).

## 2. Let go

That's it: the moment you let go of the mouse, LensCode explains what you
highlighted. (Selected with the keyboard instead? Press Ctrl+E, or Cmd+E on a
Mac. To move out of the editor with the keyboard, press Esc, then Tab.)

## 3. Read at your own pace

The panel on the right starts with a short answer in plain English, then goes
deeper: a technical definition, what it does in this code, and why it's there.

## 4. Keep going

Click a related concept to have it explained next. Everything you explain is
listed under Recent, and reopening one is instant.

## More to try

- setup.sh: terminal commands you might be told to run. Highlight one before
  you run it.
- app.py: the same idea as fetchUsers.js, written in Python.
- index.html and styles.css: how a web page is put together.

## Ready for your own code?

Click New session at the top to paste code, open a project folder or open
files. You can also drop a folder anywhere on the window.
`,
  },
  {
    id: 'fetch-users-js',
    name: 'fetchUsers.js',
    path: 'fetchUsers.js',
    language: 'javascript',
    content: `// Loads the list of users from the server.
async function fetchUsers() {
  const response = await fetch("/api/users");
  const data = await response.json();
  console.log(data);
  return data;
}

fetchUsers();
`,
  },
  {
    id: 'api-ts',
    name: 'api.ts',
    path: 'api.ts',
    language: 'typescript',
    content: `export interface User {
  id: number;
  name: string;
  email: string;
}

export async function getUsers(): Promise<User[]> {
  const response = await fetch("/api/users");
  const data = await response.json();
  return data;
}
`,
  },
  {
    id: 'setup-sh',
    name: 'setup.sh',
    path: 'setup.sh',
    language: 'shell',
    content: `# Commands you might be told to run in a terminal.
# Highlight any of them to see what it does before you run it.
git clone https://github.com/xiuxiii/lenscode.git
cd lenscode
npm install
cp .env.example .env.local
npm run dev
git checkout -b my-feature
git push -u origin my-feature
`,
  },
  {
    id: 'app-py',
    name: 'app.py',
    path: 'app.py',
    language: 'python',
    content: `import requests

def fetch_users():
    response = requests.get("https://example.com/api/users")
    data = response.json()
    for user in data:
        print(user["name"])
    return data

fetch_users()
`,
  },
  {
    id: 'index-html',
    name: 'index.html',
    path: 'index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>User Directory</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="app" class="container"></div>
    <script src="fetchUsers.js"></script>
  </body>
</html>
`,
  },
  {
    id: 'styles-css',
    name: 'styles.css',
    path: 'styles.css',
    language: 'css',
    content: `:root {
  --accent: #4f7cff;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
}

.container h1 {
  color: var(--accent);
}
`,
  },
  {
    id: 'package-json',
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "user-directory",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.0.0"
  }
}
`,
  },
]

export const TUTORIAL_PROJECT_NAME = 'user-directory'
