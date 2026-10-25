import { describe, expect, it, vi } from 'vitest'
import {
  isSecretFile,
  MAX_FILE_BYTES,
  MAX_FILES,
  pickedFromInput,
  readPickedFiles,
  type PickedFile,
} from './importFiles'

const picked = (path: string, content: string | Uint8Array = 'x'): PickedFile => ({
  file: new File([content as BlobPart], path.slice(path.lastIndexOf('/') + 1)),
  path,
})

const asFolder = { asFolder: true }
const asFiles = { asFolder: false }

describe('isSecretFile', () => {
  it.each([
    '.env',
    '.env.local',
    '.env.production',
    '.npmrc',
    '.pypirc',
    '.netrc',
    'id_rsa',
    'id_ed25519',
    'server.pem',
    'private.key',
    'cert.p12',
    'release.keystore',
    '.ENV',
    // Credential stores
    'credentials',
    '.aws/credentials',
    '.git-credentials',
    '.pgpass',
    '.htpasswd',
    '.dockercfg',
    'kubeconfig',
    'kubeconfig.yaml',
    'putty.ppk',
    'passwords.kdbx',
    // Config files that hold secrets
    'terraform.tfvars',
    'prod.auto.tfvars',
    'vars.tfvars.json',
    'secrets.yaml',
    'secrets.json',
    'app.secret',
    'prod.secrets',
    'credentials.json',
    'gcp-credentials.json',
    'client_credentials.json',
    'service-account.json',
    'service-account-prod.json',
    'serviceAccountKey.json',
    'firebase-serviceaccount.json',
    // Logins found by their folder
    '.docker/config.json',
    'home/me/.docker/config.json',
    '.kube/config',
  ])('treats %s as secret', (name) => {
    expect(isSecretFile(name)).toBe(true)
  })

  it.each([
    '.env.example',
    '.env.sample',
    '.env.template',
    '.env.dist',
    'env.js',
    'keys.ts',
    'id_rsa.pub',
    'README.md',
    // Templates of credential files, and look-alikes that hold no secrets
    'terraform.tfvars.example',
    'example.tfvars.sample',
    'secrets.example.yaml',
    'secrets.yaml.sample',
    'service-account.template.json',
    'credentials.example.json',
    'credentials.ts',
    'config.json',
    'src/config.json',
    'docker/config.json',
    '.docker/daemon.json',
    'kube/config',
    'main.tf',
    'variables.tf',
  ])('allows %s', (name) => {
    expect(isSecretFile(name)).toBe(false)
  })

  it('never allows a private key, even one named like a template', () => {
    expect(isSecretFile('server.example.pem')).toBe(true)
    expect(isSecretFile('id_rsa')).toBe(true)
  })
})

describe('readPickedFiles', () => {
  it('reads text files and keeps their paths', async () => {
    const result = await readPickedFiles(
      [picked('a.js', 'console.log(1)'), picked('src/b.py', 'print(1)')],
      asFiles,
    )
    expect(result.files).toEqual([
      { path: 'a.js', content: 'console.log(1)' },
      { path: 'src/b.py', content: 'print(1)' },
    ])
    expect(result.rootName).toBeNull()
  })

  it('strips the shared folder name when a folder is opened', async () => {
    const result = await readPickedFiles(
      [picked('my-app/index.js'), picked('my-app/src/app.js')],
      asFolder,
    )
    expect(result.rootName).toBe('my-app')
    expect(result.files.map((f) => f.path)).toEqual(['index.js', 'src/app.js'])
  })

  it('has no root when the paths do not share one folder', async () => {
    const result = await readPickedFiles([picked('a/x.js'), picked('b/y.js')], asFolder)
    expect(result.rootName).toBeNull()
    expect(result.files.map((f) => f.path)).toEqual(['a/x.js', 'b/y.js'])
  })

  it('returns files sorted by path', async () => {
    const result = await readPickedFiles([picked('z.js'), picked('a.js'), picked('m/b.js')], asFiles)
    expect(result.files.map((f) => f.path)).toEqual(['a.js', 'm/b.js', 'z.js'])
  })

  it('leaves out dependency, build and history folders, and names them', async () => {
    const result = await readPickedFiles(
      [
        picked('app/index.js'),
        picked('app/node_modules/react/index.js'),
        picked('app/.git/HEAD'),
        picked('app/dist/bundle.js'),
        picked('app/src/__pycache__/x.pyc'),
      ],
      asFolder,
    )
    expect(result.files.map((f) => f.path)).toEqual(['index.js'])
    expect(result.skipped.folders).toEqual(['.git', '__pycache__', 'dist', 'node_modules'])
  })

  it('adds folders already ignored while walking a drop to the summary', async () => {
    const result = await readPickedFiles([picked('a.js')], { asFolder: false, ignoredFolders: ['node_modules'] })
    expect(result.skipped.folders).toEqual(['node_modules'])
  })

  it('never reads secret files', async () => {
    const env = picked('.env', 'API_KEY=hunter2')
    const text = vi.spyOn(env.file, 'text')
    const result = await readPickedFiles([env, picked('.env.example', 'API_KEY='), picked('a.js')], asFiles)
    expect(result.skipped.secrets).toEqual(['.env'])
    expect(result.files.map((f) => f.path)).toEqual(['.env.example', 'a.js'])
    expect(text).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain('hunter2')
  })

  it('never reads credential files, and opens their templates', async () => {
    const tfvars = picked('infra/terraform.tfvars', 'db_password = "hunter2"')
    const text = vi.spyOn(tfvars.file, 'text')
    const result = await readPickedFiles(
      [
        tfvars,
        picked('infra/terraform.tfvars.example', 'db_password = ""'),
        picked('infra/main.tf'),
        picked('.docker/config.json', '{"auths": {}}'),
        picked('app/config.json', '{}'),
      ],
      asFiles,
    )
    expect(result.skipped.secrets).toEqual(['.docker/config.json', 'infra/terraform.tfvars'])
    expect(result.files.map((f) => f.path)).toEqual([
      'app/config.json',
      'infra/main.tf',
      'infra/terraform.tfvars.example',
    ])
    expect(text).not.toHaveBeenCalled()
  })

  it('skips Docker’s config.json when the .docker folder itself is opened', async () => {
    const result = await readPickedFiles(
      [picked('.docker/config.json', '{"auths": {}}'), picked('.docker/daemon.json', '{}')],
      asFolder,
    )
    expect(result.rootName).toBe('.docker')
    expect(result.skipped.secrets).toEqual(['config.json'])
    expect(result.files.map((f) => f.path)).toEqual(['daemon.json'])
  })

  it('skips binary files by extension', async () => {
    const result = await readPickedFiles([picked('logo.png'), picked('font.woff2'), picked('a.js')], asFiles)
    expect(result.skipped.binary).toBe(2)
    expect(result.files.map((f) => f.path)).toEqual(['a.js'])
  })

  it('skips files whose content turns out to be binary', async () => {
    const result = await readPickedFiles(
      [picked('data.bin2', new Uint8Array([72, 0, 73])), picked('a.js')],
      asFiles,
    )
    expect(result.skipped.binary).toBe(1)
    expect(result.files.map((f) => f.path)).toEqual(['a.js'])
  })

  it('skips OS clutter without mentioning it', async () => {
    const result = await readPickedFiles([picked('.DS_Store'), picked('Thumbs.db'), picked('a.js')], asFiles)
    expect(result.files.map((f) => f.path)).toEqual(['a.js'])
    expect(result.skipped).toEqual({ folders: [], secrets: [], binary: 0, tooLarge: [], overLimit: 0 })
  })

  it('skips files over the per-file size limit', async () => {
    const big = picked('big.js', 'x'.repeat(MAX_FILE_BYTES + 1))
    const result = await readPickedFiles([big, picked('a.js')], asFiles)
    expect(result.skipped.tooLarge).toEqual(['big.js'])
    expect(result.files.map((f) => f.path)).toEqual(['a.js'])
  })

  it('accepts a file exactly at the size limit', async () => {
    const result = await readPickedFiles([picked('edge.js', 'x'.repeat(MAX_FILE_BYTES))], asFiles)
    expect(result.files).toHaveLength(1)
  })

  it('stops at the file-count cap and counts the rest', async () => {
    const many = Array.from({ length: MAX_FILES + 3 }, (_, i) => picked(`f${String(i).padStart(5, '0')}.txt`))
    const result = await readPickedFiles(many, asFiles)
    expect(result.files).toHaveLength(MAX_FILES)
    expect(result.skipped.overLimit).toBe(3)
  })

  it('reports nothing opened for an empty pick', async () => {
    const result = await readPickedFiles([], asFiles)
    expect(result.files).toEqual([])
  })
})

describe('pickedFromInput', () => {
  it('uses the relative path from a folder picker, else the file name', () => {
    const inFolder = new File(['x'], 'a.js')
    Object.defineProperty(inFolder, 'webkitRelativePath', { value: 'proj/src/a.js' })
    const single = new File(['x'], 'b.js')
    const list = [inFolder, single] as unknown as FileList
    expect(pickedFromInput(list).map((p) => p.path)).toEqual(['proj/src/a.js', 'b.js'])
  })

  it('handles a missing file list', () => {
    expect(pickedFromInput(null)).toEqual([])
  })
})
