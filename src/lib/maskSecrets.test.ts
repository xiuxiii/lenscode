import { describe, expect, it } from 'vitest'
import { HIDDEN_SECRET, maskSecrets } from './maskSecrets'

// Every value below is made up, and shorter than the real formats where a
// secret scanner might otherwise mistake it for a live key.

/** A private key block; the markers are assembled so no real-looking key sits in this file. */
const keyBlock = (kind: string, lines: string[], indent = '') =>
  [`-----BEGIN ${kind}PRIVATE KEY-----`, ...lines, `-----END ${kind}PRIVATE KEY-----`]
    .map((line) => indent + line)
    .join('\n')

const KEY_LINES = Array.from({ length: 6 }, (_, i) => `MIIEfakeKEY${i}abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV+/`)
/**
 * Made up, but in DeepSeek's exact format, so it is built here rather than
 * written out: GitHub's push protection blocks a literal that looks like a key.
 */
const FAKE_DEEPSEEK_KEY = `sk-${'0123456789abcdef'.repeat(2)}`

describe('maskSecrets: hides', () => {
  it.each([
    ['an OpenAI key', 'const API_KEY = "sk-proj-abc123def456ghi789jkl"', 'const API_KEY = "[hidden secret]"'],
    ['an Anthropic key in a command', 'ANTHROPIC_API_KEY=sk-ant-api03-abc123DEF456ghi789 claude', 'ANTHROPIC_API_KEY=[hidden secret] claude'],
    ['a DeepSeek key on its own', FAKE_DEEPSEEK_KEY, '[hidden secret]'],
    ['an AWS access key id', 'aws_access_key_id = AKIAZZZZ1234ZZZZ5678', 'aws_access_key_id = [hidden secret]'],
    ['an AWS temporary key id', '"AccessKeyId": "ASIAZZZZ1234ZZZZ5678",', '"AccessKeyId": "[hidden secret]",'],
    ['an AWS secret access key', 'aws_secret_access_key = Abc1Def2Ghi3Jkl4Mno5Pqr6Stu7Vwx8Yz90AbCd', 'aws_secret_access_key = [hidden secret]'],
    ['an AWS secret in a command', 'aws configure set aws_secret_access_key Abc1Def2Ghi3Jkl4Mno5Pqr6Stu7Vwx8Yz90AbCd', 'aws configure set aws_secret_access_key [hidden secret]'],
    ['an AWS secret in JSON', '"SecretAccessKey": "Abc1Def2Ghi3Jkl4Mno5Pqr6Stu7Vwx8Yz90AbCd"', '"SecretAccessKey": "[hidden secret]"'],
    ['a GitHub token in a clone URL', 'git clone https://ghp_abcdefghij0123456789@github.com/me/app', 'git clone https://[hidden secret]@github.com/me/app'],
    ['a GitHub OAuth token', 'token: gho_abcdefghij0123456789', 'token: [hidden secret]'],
    ['a GitHub user token', 'gh auth login ghu_abcdefghij0123456789', 'gh auth login [hidden secret]'],
    ['a GitHub server token', 'GITHUB_TOKEN: ghs_abcdefghij0123456789', 'GITHUB_TOKEN: [hidden secret]'],
    ['a GitHub refresh token', '{"refresh": "ghr_abcdefghij0123456789"}', '{"refresh": "[hidden secret]"}'],
    ['a fine-grained GitHub token', 'github_pat_11FAKE0123_abcdefghijklmnop', '[hidden secret]'],
    ['a Slack bot token', 'SLACK_TOKEN=xoxb-0000-fake-token-1234', 'SLACK_TOKEN=[hidden secret]'],
    ['a Slack user token', "slack.WebClient('xoxp-0000-fake-token-1234')", "slack.WebClient('[hidden secret]')"],
    ['a Google API key', 'apiKey: "AIzaFAKE0123456789abcdefghij",', 'apiKey: "[hidden secret]",'],
    ['a Stripe live secret key', 'stripe.api_key = "sk_live_FAKE0123456789ab"', 'stripe.api_key = "[hidden secret]"'],
    ['a Stripe restricted key', 'Stripe(rk_live_FAKE0123456789ab)', 'Stripe([hidden secret])'],
    [
      'a JSON Web Token',
      "const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'",
      "const jwt = '[hidden secret]'",
    ],
    [
      'a bearer token in curl',
      'curl -H "Authorization: Bearer abc123def456ghi789jkl" https://api.example.com',
      'curl -H "Authorization: Bearer [hidden secret]" https://api.example.com',
    ],
    ['a password in a database URL', 'DATABASE_URL=postgres://admin:hunter2@db.example.com:5432/app', 'DATABASE_URL=postgres://admin:[hidden secret]@db.example.com:5432/app'],
    ['a password in a URL with no user', 'redis://:p4ssw0rd@localhost:6379', 'redis://:[hidden secret]@localhost:6379'],
    ['a short URL password', 'https://user:pass@example.com/feed', 'https://user:[hidden secret]@example.com/feed'],
    ['a password', 'password = "hunter2hunter2"', 'password = "[hidden secret]"'],
    ['a secret with words in it', "const secret = 'my-super-secret-value'", "const secret = '[hidden secret]'"],
    ['a passphrase', 'user_pwd: "correct horse battery staple"', 'user_pwd: "[hidden secret]"'],
    ['a JSON field', '"client_secret": "abc123def456",', '"client_secret": "[hidden secret]",'],
    ['a YAML value', 'db_password: s3cret-pass', 'db_password: [hidden secret]'],
    ['a .env value made of letters', 'AUTH_TOKEN=abcdefgh', 'AUTH_TOKEN=[hidden secret]'],
    ['a shell export', 'export DB_PASS=abc123def456', 'export DB_PASS=[hidden secret]'],
    ['a docker -e flag', 'docker run -e POSTGRES_PASSWORD=supersecret postgres', 'docker run -e POSTGRES_PASSWORD=[hidden secret] postgres'],
    ['a command-line flag', 'mytool --password=abc123def456', 'mytool --password=[hidden secret]'],
    ['an HTTP header', 'x-api-key: abc123def456', 'x-api-key: [hidden secret]'],
    ['a Basic auth header', 'headers: { Authorization: "Basic dXNlcjpwYXNzd29yZA==" }', 'headers: { Authorization: "[hidden secret]" }'],
    ['an .npmrc token', '//registry.npmjs.org/:_authToken=npm_abc123def456', '//registry.npmjs.org/:_authToken=[hidden secret]'],
    ['a Go assignment', 'apiKey := "abc123def456"', 'apiKey := "[hidden secret]"'],
    ['a PHP variable', "$dbPassword = 'abc123def456';", "$dbPassword = '[hidden secret]';"],
    ['a WordPress define', "define( 'DB_PASSWORD', 'abc123def456' );", "define( 'DB_PASSWORD', '[hidden secret]' );"],
    ['a dictionary entry', "app.config['SECRET_KEY'] = 'abc123def456'", "app.config['SECRET_KEY'] = '[hidden secret]'"],
    ['a typed TypeScript constant', 'const API_KEY: string = "abc123def456"', 'const API_KEY: string = "[hidden secret]"'],
    ['a typed Python variable', 'password: str = "abc123def456"', 'password: str = "[hidden secret]"'],
    ['a default argument', 'def connect(password="abc123def456"):', 'def connect(password="[hidden secret]"):'],
    ['a connection string', '"Server=db;User Id=sa;Password=abc123def456;"', '"Server=db;User Id=sa;Password=[hidden secret];"'],
  ])('%s', (_name, code, masked) => {
    expect(maskSecrets(code)).toEqual({ text: masked, count: 1 })
  })
})

describe('maskSecrets: leaves alone', () => {
  it.each([
    // Placeholders
    'API_KEY=your-key-here',
    'const API_KEY = "your_api_key"',
    'token: "xxxxxxxxxxxxxxxx"',
    'aws_access_key_id = AKIAXXXXXXXXXXXXXXXX',
    'password: changeme',
    'apiKey: "<your-api-key>"',
    'OPENAI_API_KEY=sk-...',
    'password: "********"',
    'secret: "[REDACTED]"',
    'aws_access_key_id = AKIAIOSFODNN7EXAMPLE',
    'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'postgres://user:<password>@localhost/app',
    // Environment lookups
    'const apiKey = process.env.OPENAI_API_KEY',
    'api_key = os.environ["API_KEY"]',
    'token = os.getenv("GITHUB_TOKEN")',
    'password: ${DB_PASSWORD}',
    'PASSWORD=$DB_PASSWORD',
    'token: ${{ secrets.GITHUB_TOKEN }}',
    'set API_KEY=%MY_KEY%',
    'postgres://app:${DB_PASSWORD}@db/app',
    'client = OpenAI(api_key=OPENAI_API_KEY)',
    // Ordinary code
    'const token = getToken()',
    'const token = await getToken()',
    'password: string',
    'password?: string;',
    'const password = passwordInput.value',
    "passwordInput.value = ''",
    'if (key in obj) {',
    'for (const key of Object.keys(obj)) {}',
    'items.map(key => key.trim())',
    'token: Optional[str] = None',
    'secret = undefined',
    'auth: true',
    'const { password } = req.body',
    'localStorage.getItem("auth_token")',
    'max_tokens: 1500',
    'Authorization: "Bearer " + token',
    'headers.Authorization = `Bearer ${token}`',
    // Names that only contain the words, and values that are not secrets
    '"author": "Jane Doe"',
    'keyboardShortcut = "Ctrl+Shift+E"',
    'tokenizer = "bert-base-uncased"',
    'fetch(url, { credentials: "same-origin" })',
    '<input type="password" autocomplete="current-password">',
    'grant_type: "password"',
    'AUTH_URL = "https://auth.example.com/login"',
    'keyFile = "/etc/ssl/private/server.key"',
    'PWD=/home/user/project',
    'const PASSWORD_HINT = "Use at least 8 characters."',
    '"forgotPassword": "Forgot your password?"',
    '.sk-folding-cube-container-large { color: red }',
    '// Send a Bearer authorization-header with every call',
    // Other text that looks a little like a secret
    'http://localhost:3000/api',
    'mailto:support@example.com',
    'git@github.com:me/app.git',
    'pip install scikit-learn',
  ])('%s', (code) => {
    expect(maskSecrets(code)).toEqual({ text: code, count: 0 })
  })

  it('leaves code that only names the private key markers', () => {
    const code = [
      `const HEADER = '${keyBlock('', []).split('\n')[0]}'`,
      `const FOOTER = '${keyBlock('', []).split('\n')[1]}'`,
    ].join('\n')
    expect(maskSecrets(code)).toEqual({ text: code, count: 0 })
  })
})

describe('maskSecrets: private keys', () => {
  it('keeps the BEGIN and END lines and every line break', () => {
    const file = ['const a = 1', keyBlock('RSA ', KEY_LINES), 'const b = 2'].join('\n')
    const { text, count } = maskSecrets(file)
    const before = file.split('\n')
    const after = text.split('\n')
    expect(count).toBe(1)
    expect(after).toHaveLength(before.length)
    expect(after[1]).toBe(before[1])
    expect(after[2]).toBe(HIDDEN_SECRET)
    expect(after.slice(3, 8)).toEqual(['', '', '', '', ''])
    expect(after.slice(-2)).toEqual(before.slice(-2))
    expect(text).not.toContain('MIIEfake')
  })

  it('keeps the indentation of a key inside YAML', () => {
    const yaml = ['tls:', '  key: |', keyBlock('', KEY_LINES, '    '), 'next: 1'].join('\n')
    const after = maskSecrets(yaml).text.split('\n')
    expect(after).toHaveLength(yaml.split('\n').length)
    expect(after[3]).toBe(`    ${HIDDEN_SECRET}`)
    expect(after.at(-2)).toMatch(/^ {4}-----END PRIVATE KEY-----$/)
  })

  it('hides a key written as one string with \\n escapes', () => {
    const block = keyBlock('', KEY_LINES).replaceAll('\n', '\\n')
    const json = `{"type": "service_account", "private_key": "${block}\\n", "client_id": "123"}`
    const { text, count } = maskSecrets(json)
    expect(count).toBe(1)
    expect(text).toBe(
      `{"type": "service_account", "private_key": "-----BEGIN PRIVATE KEY-----${HIDDEN_SECRET}-----END PRIVATE KEY-----\\n", "client_id": "123"}`,
    )
  })

  it('hides an OpenSSH key cut off before its END line', () => {
    const cut = keyBlock('OPENSSH ', KEY_LINES.slice(0, 2)).split('\n').slice(0, 3).join('\n')
    const { text, count } = maskSecrets(cut)
    expect(count).toBe(1)
    expect(text.split('\n')).toEqual(['-----BEGIN OPENSSH PRIVATE KEY-----', HIDDEN_SECRET, ''])
  })

  it('hides an encrypted key with headers', () => {
    const block = keyBlock('RSA ', ['Proc-Type: 4,ENCRYPTED', 'DEK-Info: AES-128-CBC,3F17F5316E2BAC89', '', ...KEY_LINES])
    const { text, count } = maskSecrets(block)
    expect(count).toBe(1)
    expect(text).not.toContain('MIIEfake')
    expect(text.split('\n')).toHaveLength(block.split('\n').length)
  })
})

describe('maskSecrets: results', () => {
  it('counts every value it hides', () => {
    const env = ['OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl', 'DB_PASSWORD=abc123def456', 'DEBUG=true'].join('\n')
    expect(maskSecrets(env)).toEqual({
      text: ['OPENAI_API_KEY=[hidden secret]', 'DB_PASSWORD=[hidden secret]', 'DEBUG=true'].join('\n'),
      count: 2,
    })
  })

  it('does not hide a value twice', () => {
    const once = maskSecrets('const API_KEY = "sk-proj-abc123def456ghi789jkl"').text
    expect(maskSecrets(once)).toEqual({ text: once, count: 0 })
  })

  it('never changes the number of lines', () => {
    const code = ['password = "abc123def456"', 'url = "https://u:p4ss@h"', keyBlock('EC ', KEY_LINES), 'ok = 1'].join('\n')
    expect(maskSecrets(code).text.split('\n')).toHaveLength(code.split('\n').length)
  })

  it('hides the whole of a long value', () => {
    const base64 = 'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFb3dJQkFBS0NBUUVB'.repeat(20)
    expect(maskSecrets(`  tls.key: ${base64}\n  other: 1`).text).toBe(`  tls.key: ${HIDDEN_SECRET}\n  other: 1`)
  })

  it('stays fast on large, awkward input', () => {
    // Shapes that make careless patterns backtrack for minutes.
    for (const awkward of [
      'a.'.repeat(250_000),
      'http://a:b'.repeat(50_000),
      `${keyBlock('', []).split('\n')[0]}`.repeat(18_000),
      'sk-'.repeat(160_000),
      'token: a b c d e f g h '.repeat(20_000),
      '"password", '.repeat(40_000),
    ]) {
      expect(maskSecrets(awkward).text).toHaveLength(awkward.length)
    }
  })
})
