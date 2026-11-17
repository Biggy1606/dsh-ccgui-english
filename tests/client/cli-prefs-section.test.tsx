// @vitest-environment jsdom
/// <reference lib="dom" />

import { act, cleanup, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createCliPrefs } from '../../src/client/cli-prefs.ts'
import type { CliPrefsStorage } from '../../src/client/cli-prefs.ts'
import { CLI_PREFS_STYLES, CliPrefsSection } from '../../src/client/cli-prefs-section.tsx'

function memoryStorage(): CliPrefsStorage {
  let items: Readonly<Record<string, string>> = {}
  return {
    getItem: (key) => items[key] ?? null,
    setItem: (key, value) => {
      items = { ...items, [key]: value }
    },
  }
}

function seeded() {
  const prefs = createCliPrefs(memoryStorage())
  prefs.remember([
    { id: 'deepseek-official', label: 'DeepSeek' },
    { id: 'cli-claude', label: 'Claude Code' },
    { id: 'cli-codex', label: 'Codex CLI' },
  ])
  return prefs
}

function rowNames(): readonly string[] {
  return screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label') ?? '')
}

afterEach(() => {
  cleanup()
})

describe('CliPrefsSection', () => {
  it('explains where the list comes from before any provider is known', () => {
    render(<CliPrefsSection prefs={createCliPrefs(memoryStorage())} />)
    expect(screen.getByText('Open a session to see the available CLIs here.')).toBeDefined()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('lists known providers with their marks, disabling moves past either end', () => {
    render(<CliPrefsSection prefs={seeded()} />)
    expect(rowNames()).toEqual(['DeepSeek', 'Claude Code', 'Codex CLI'])
    const [first, , last] = screen.getAllByRole('listitem')
    expect(first?.querySelector('svg')).not.toBeNull()
    expect(within(first ?? document.body).getByRole('button', { name: 'Move DeepSeek up' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(within(last ?? document.body).getByRole('button', { name: 'Move Codex CLI down' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(CLI_PREFS_STYLES).toContain('.dsh-ccgui-cli-prefs')
    expect(
      screen.getByText('Choose the order and visibility of CLIs in the composer menu. Disabled CLIs are hidden.'),
    ).toBeDefined()
    expect(screen.getByText('More CLIs coming soon…')).toBeDefined()
  })

  it('reorders providers with the arrow buttons', async () => {
    const prefs = seeded()
    render(<CliPrefsSection prefs={prefs} />)
    await userEvent.click(screen.getByRole('button', { name: 'Move Codex CLI up' }))
    expect(rowNames()).toEqual(['DeepSeek', 'Codex CLI', 'Claude Code'])
    await userEvent.click(screen.getByRole('button', { name: 'Move DeepSeek down' }))
    expect(rowNames()).toEqual(['Codex CLI', 'DeepSeek', 'Claude Code'])
    expect(prefs.getSnapshot().order).toEqual(['cli-codex', 'deepseek-official', 'cli-claude'])
  })

  it('drops the row of a provider the switcher stops listing', () => {
    const prefs = seeded()
    render(<CliPrefsSection prefs={prefs} />)
    expect(rowNames()).toEqual(['DeepSeek', 'Claude Code', 'Codex CLI'])
    act(() => {
      prefs.remember([
        { id: 'deepseek-official', label: 'DeepSeek' },
        { id: 'cli-claude', label: 'Claude Code' },
      ])
    })
    expect(rowNames()).toEqual(['DeepSeek', 'Claude Code'])
  })

  it('shows the built-in provider without a switch', () => {
    render(<CliPrefsSection prefs={seeded()} />)
    expect(screen.queryByRole('switch', { name: 'Enable DeepSeek' })).toBeNull()
    expect(screen.getByText('Built-in provider; always visible')).toBeDefined()
    expect(screen.getByRole('switch', { name: 'Enable Claude Code' })).toBeDefined()
  })

  it('turns a CLI off with visible feedback and back on', async () => {
    const prefs = seeded()
    render(<CliPrefsSection prefs={prefs} />)
    const claude = screen.getByRole('switch', { name: 'Enable Claude Code' })
    expect(claude.getAttribute('title')).toBe('Disable to hide from the CLI menu')
    await userEvent.click(claude)
    expect(prefs.getSnapshot().hidden).toEqual(['cli-claude'])
    expect(claude.getAttribute('aria-checked')).toBe('false')
    expect(claude.getAttribute('title')).toBe('Enable to show in the CLI menu')
    expect(screen.getByText('Disabled; hidden from the CLI menu')).toBeDefined()
    // Any CLI can be turned off at once; DeepSeek keeps the switcher from being empty.
    await userEvent.click(screen.getByRole('switch', { name: 'Enable Codex CLI' }))
    expect(prefs.getSnapshot().hidden).toEqual(['cli-claude', 'cli-codex'])
    await userEvent.click(claude)
    expect(prefs.getSnapshot().hidden).toEqual(['cli-codex'])
  })
})
