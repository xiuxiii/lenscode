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
- more-examples/: the same kind of code in SQL, Go, Rust, Java, C, C++, C#,
  PHP, Ruby, YAML, PowerShell and a Dockerfile, plus git-basics.sh, the
  everyday git commands (and two to be careful with).

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
  {
    id: 'more-users-sql',
    name: 'users.sql',
    path: 'more-examples/users.sql',
    language: 'sql',
    content: `-- A table of users, and a few questions you might ask it.
-- Highlight any keyword (SELECT, WHERE, JOIN...) to see what it does.

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  signed_up DATE
);

INSERT INTO users (name, email, signed_up)
VALUES ('Ada', 'ada@example.com', '2024-01-15'),
       ('Linus', 'linus@example.com', '2024-03-02');

-- Everyone who signed up this year, newest first.
SELECT name, email
FROM users
WHERE signed_up >= '2024-01-01'
ORDER BY signed_up DESC;

-- How many orders each user has placed.
SELECT users.name, COUNT(orders.id) AS order_count
FROM users
LEFT JOIN orders ON orders.user_id = users.id
GROUP BY users.name;
`,
  },
  {
    id: 'more-main-go',
    name: 'main.go',
    path: 'more-examples/main.go',
    language: 'go',
    content: `// A tiny program that looks up a user, in Go.
package main

import (
	"errors"
	"fmt"
)

type User struct {
	Name  string
	Email string
}

func findUser(users []User, name string) (User, error) {
	for _, user := range users {
		if user.Name == name {
			return user, nil
		}
	}
	return User{}, errors.New("user not found")
}

func main() {
	users := []User{
		{Name: "Ada", Email: "ada@example.com"},
		{Name: "Linus", Email: "linus@example.com"},
	}

	user, err := findUser(users, "Ada")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Println("Found", user.Name, "at", user.Email)
}
`,
  },
  {
    id: 'more-main-rs',
    name: 'main.rs',
    path: 'more-examples/main.rs',
    language: 'rust',
    content: `// The same user lookup, written in Rust.
struct User {
    name: String,
    email: String,
}

fn find_user<'a>(users: &'a [User], name: &str) -> Option<&'a User> {
    users.iter().find(|user| user.name == name)
}

fn main() {
    let users = vec![
        User { name: String::from("Ada"), email: String::from("ada@example.com") },
        User { name: String::from("Linus"), email: String::from("linus@example.com") },
    ];

    match find_user(&users, "Ada") {
        Some(user) => println!("Found {} at {}", user.name, user.email),
        None => println!("User not found"),
    }

    let mut count = 0;
    for _user in &users {
        count += 1;
    }
    println!("There are {} users", count);
}
`,
  },
  {
    id: 'more-userlist-java',
    name: 'UserList.java',
    path: 'more-examples/UserList.java',
    language: 'java',
    content: `import java.util.ArrayList;
import java.util.List;

// A list of users, in Java. Every Java program starts in a "main" method.
public class UserList {
    private final List<String> names = new ArrayList<>();

    public void add(String name) {
        names.add(name);
    }

    public int size() {
        return names.size();
    }

    public static void main(String[] args) {
        UserList users = new UserList();
        users.add("Ada");
        users.add("Linus");

        for (String name : users.names) {
            System.out.println("Hello, " + name);
        }
        System.out.println("Total: " + users.size());
    }
}
`,
  },
  {
    id: 'more-names-c',
    name: 'names.c',
    path: 'more-examples/names.c',
    language: 'c',
    content: `#include <stdio.h>
#include <string.h>

/* Prints each user's name and how many letters it has, in C. */
int main(void) {
    const char *users[] = {"Ada", "Linus", "Grace"};
    int count = sizeof(users) / sizeof(users[0]);

    for (int i = 0; i < count; i++) {
        printf("%s has %zu letters\\n", users[i], strlen(users[i]));
    }
    return 0;
}
`,
  },
  {
    id: 'more-users-cpp',
    name: 'users.cpp',
    path: 'more-examples/users.cpp',
    language: 'cpp',
    content: `#include <iostream>
#include <string>
#include <vector>

// The same list of users, in C++.
int main() {
    std::vector<std::string> users = {"Ada", "Linus", "Grace"};
    users.push_back("Margaret");

    for (const auto& name : users) {
        std::cout << "Hello, " << name << std::endl;
    }
    std::cout << users.size() << " users" << std::endl;
    return 0;
}
`,
  },
  {
    id: 'more-program-cs',
    name: 'Program.cs',
    path: 'more-examples/Program.cs',
    language: 'csharp',
    content: `using System;
using System.Collections.Generic;
using System.Linq;

// A list of users, in C#.
namespace UserDirectory
{
    public class User
    {
        public string Name { get; set; }
        public string Email { get; set; }
    }

    class Program
    {
        static void Main(string[] args)
        {
            var users = new List<User>
            {
                new User { Name = "Ada", Email = "ada@example.com" },
                new User { Name = "Linus", Email = "linus@example.com" },
            };

            var names = users.Select(u => u.Name).OrderBy(n => n);
            foreach (var name in names)
            {
                Console.WriteLine($"Hello, {name}");
            }
        }
    }
}
`,
  },
  {
    id: 'more-users-php',
    name: 'users.php',
    path: 'more-examples/users.php',
    language: 'php',
    content: `<?php
// A web page that lists users, in PHP.
$users = [
    ['name' => 'Ada', 'email' => 'ada@example.com'],
    ['name' => 'Linus', 'email' => 'linus@example.com'],
];

function greet(string $name): string {
    return "Hello, " . htmlspecialchars($name);
}
?>
<ul>
<?php foreach ($users as $user): ?>
  <li><?= greet($user['name']) ?></li>
<?php endforeach; ?>
</ul>
`,
  },
  {
    id: 'more-users-rb',
    name: 'users.rb',
    path: 'more-examples/users.rb',
    language: 'ruby',
    content: `# A list of users, in Ruby.
class User
  attr_reader :name, :email

  def initialize(name, email)
    @name = name
    @email = email
  end

  def greeting
    "Hello, #{name}!"
  end
end

users = [
  User.new("Ada", "ada@example.com"),
  User.new("Linus", "linus@example.com")
]

users.each do |user|
  puts user.greeting
end

puts "#{users.length} users"
`,
  },
  {
    id: 'more-ci-yml',
    name: 'ci.yml',
    path: 'more-examples/ci.yml',
    language: 'yaml',
    content: `# Runs the tests on GitHub every time someone pushes code.
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
`,
  },
  {
    id: 'more-dockerfile',
    name: 'Dockerfile',
    path: 'more-examples/Dockerfile',
    language: 'dockerfile',
    content: `# Packages the app into a container image that runs the same everywhere.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first, so this step is cached between builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
`,
  },
  {
    id: 'more-git-basics-sh',
    name: 'git-basics.sh',
    path: 'more-examples/git-basics.sh',
    language: 'shell',
    content: `# Everyday git commands, in the order you'd usually use them.
# Highlight one to see what it does before you run it.

# Get a copy of a project
git clone https://github.com/user/project.git
cd project

# See what you've changed
git status
git diff

# Save your changes
git add .
git commit -m "Describe what you changed"

# Work on something new without touching main
git checkout -b my-feature
git push -u origin my-feature

# Get other people's changes
git pull

# Careful: these throw work away and can't easily be undone
git reset --hard HEAD
git push --force
`,
  },
  {
    id: 'more-cleanup-ps1',
    name: 'cleanup.ps1',
    path: 'more-examples/cleanup.ps1',
    language: 'powershell',
    content: `# Windows PowerShell: look around and tidy a project folder.
# Highlight a line to see what it does before you run it.

# Where am I, and what's here?
Get-Location
Get-ChildItem

# Set a variable for this window only
$env:NODE_ENV = "development"

# Delete the build folder (careful: it skips the Recycle Bin)
Remove-Item -Path .\\dist -Recurse -Force

# Find every TODO in the JavaScript files
Get-ChildItem -Recurse -Filter *.js | Select-String "TODO"
`,
  },
]

export const TUTORIAL_PROJECT_NAME = 'user-directory'
