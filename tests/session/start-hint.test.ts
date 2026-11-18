import { describe, expect, it } from 'vitest'
import { startHint } from '../../src/session/start-hint.ts'

// Trimmed from a real report: npx cached @openai/codex without its platform binary.
const MISSING_BINARY = [
  'Codex process has exited with code 1: file:///Users/someone/.npm/_npx/c51fd8e4d04c136d/node_modules/@openai/codex/bin/codex.js:107',
  'throw new Error( ^ Error: Missing optional dependency @openai/codex-darwin-arm64.',
  'Reinstall Codex: npm install -g @openai/codex@latest',
].join(' ')

describe('startHint', () => {
  it('points at the broken npx cache instead of asking the user to install', () => {
    const hint = startHint(MISSING_BINARY)
    expect(hint).toContain('/Users/someone/.npm/_npx/c51fd8e4d04c136d')
    expect(hint).not.toContain('file://')
    expect(hint).not.toContain('Make sure it is installed')
  })

  it('finds a plain path and a module the cache never got', () => {
    const message = "Cannot find module 'x' imported from /home/u/.npm/_npx/abc123/node_modules/y/index.js"
    expect(startHint(message)).toContain('/home/u/.npm/_npx/abc123')
  })

  it('asks for a reinstall when a global install is missing its binary', () => {
    const hint = startHint('Error: Missing optional dependency @openai/codex-darwin-arm64. Reinstall Codex')
    expect(hint).toContain('installation is incomplete')
    expect(hint).not.toContain('_npx')
  })

  // What npm prints when npx finds a cache entry whose install never finished (Windows report).
  it('names a Windows cache entry with spaces in its path when npm cannot read its package.json', () => {
    const message = [
      '进程退出，退出码 4294963238（即 -4058）。它退出前的输出：npm error code ENOENT',
      'npm error syscall open',
      'npm error path C:\\Program Files\\nodejs\\node_cache\\_npx\\928bb229ebc08fcf\\package.json',
      'npm error errno -4058',
      "npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'C:\\Program Files\\nodejs\\node_cache\\_npx\\928bb229ebc08fcf\\package.json'",
    ].join('\n')
    const hint = startHint(message)
    expect(hint).toContain('Delete C:\\Program Files\\nodejs\\node_cache\\_npx\\928bb229ebc08fcf and retry')
  })

  it('keeps the install hint for anything else', () => {
    expect(startHint('spawn opencode ENOENT')).toBe('Make sure it is installed and you are logged in.')
  })

  it('does not blame the cache for an ordinary failure that merely runs from it', () => {
    expect(startHint('auth required at /Users/u/.npm/_npx/abc123/node_modules/a.js')).toBe(
      'Make sure it is installed and you are logged in.',
    )
  })
})
