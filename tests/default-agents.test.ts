import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const AGENT = /^ {10}- id: (\S+)\n {12}name: (.+)$/gm

describe('the default CLIs', () => {
  // Existing names and order follow desktop-cc-gui; additional CLIs are included too.
  it('register the expected names and order', () => {
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect([...patch.matchAll(AGENT)].map(([, id, name]) => [id, name])).toEqual([
      ['claude', 'Claude Code'],
      ['kimi', 'Kimi CLI'],
      ['codex', 'Codex CLI'],
      ['pi', 'PI CLI'],
      ['omp', 'OMP CLI'],
      ['opencode', 'OpenCode'],
      ['devin', 'Devin CLI'],
      ['codebuddy', 'CodeBuddy CLI'],
    ])
  })

  it('starts Devin in ACP mode via PATH', () => {
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toMatch(/- id: devin\n\s+name: Devin CLI\n\s+command: devin\n\s+args: \[acp\]/)
  })
})
