import type { WorkspaceFile } from '../types/workspace'

/**
 * Small, realistic files that open in the workspace by default so the
 * product never starts empty. Each one exercises a handful of concepts
 * that the mock explanation catalog knows how to explain.
 */
export const STARTER_FILES: WorkspaceFile[] = [
  {
    id: 'fetch-users-js',
    name: 'fetchUsers.js',
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
    id: 'app-py',
    name: 'app.py',
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

export const DEFAULT_PROJECT_NAME = 'user-directory'
