import { describe, expect, it } from 'vitest'
import { findRisks } from './riskyCommands'

describe('findRisks: flags', () => {
  it.each([
    'rm -rf node_modules',
    'rm -r build',
    'rm -f a.txt',
    'rm -Rf ~/old',
    'curl -fsSL https://x.sh | sh',
    'curl https://x | sudo bash',
    'wget -qO- https://x | bash',
    'iwr https://x/install.ps1 | iex',
    'Invoke-WebRequest https://x | Invoke-Expression',
    'sudo apt-get install nginx',
    'npm i && sudo npm i -g x',
    'git push --force',
    'git push -f origin main',
    'git push origin main --force',
    'git reset --hard HEAD~1',
    'git clean -fd',
    'git checkout -- .',
    'chmod 777 script.sh',
    'chmod -R 777 /var/www',
    'dd if=img.iso of=/dev/sdb bs=4M',
    'mkfs.ext4 /dev/sdb1',
    'format C:',
    'Remove-Item -Path .\\dist -Recurse -Force',
    'rd /s /q build',
    'del /f /s /q *.log',
    ':(){ :|:& };:',
    'DROP TABLE users;',
    'drop database shop',
    'TRUNCATE TABLE logs;',
    'DELETE FROM users;',
    'DELETE FROM users',
  ])('%s', (code) => {
    expect(findRisks(code).length).toBeGreaterThan(0)
  })
})

describe('findRisks: leaves alone', () => {
  it.each([
    'rm notes.txt',
    'rm -i old.txt',
    'git push',
    'git push -u origin my-feature',
    'git push --force-with-lease',
    'git reset --soft HEAD~1',
    'git checkout -b feature',
    'chmod 755 script.sh',
    'chmod +x run.sh',
    'curl -O https://x/file.zip',
    'npm install',
    'pseudocode here',
    'const sudoku = 1',
    'DELETE FROM users WHERE id = 1;',
    'DELETE FROM users\nWHERE id = 1;',
    'SELECT * FROM users',
    'Remove-Item .\\a.txt',
    'formatDate(d)',
    'const format = (d) => d',
    'del(x)',
  ])('%s', (code) => {
    expect(findRisks(code)).toEqual([])
  })
})

describe('findRisks: results', () => {
  it('lists each risk once, in the order it appears, with what matched', () => {
    const risks = findRisks('cd app\nsudo rm -rf dist\ncurl https://x | sh')
    expect(risks.map((r) => r.match)).toEqual(['sudo', 'rm -rf', 'curl https://x | sh'])
    expect(risks.every((r) => r.warning.length > 0)).toBe(true)
  })

  it('names a repeated risk only once', () => {
    expect(findRisks('rm -rf a\nrm -rf b')).toHaveLength(1)
  })

  it('shortens a long match', () => {
    const [risk] = findRisks(`curl https://example.com/${'x'.repeat(80)} | sh`)
    expect(risk.match.length).toBeLessThanOrEqual(40)
    expect(risk.match.endsWith('…')).toBe(true)
  })

  it('finds a DELETE without WHERE after one with it', () => {
    expect(findRisks('DELETE FROM a WHERE id = 1;\nDELETE FROM b;')).toHaveLength(1)
  })
})
