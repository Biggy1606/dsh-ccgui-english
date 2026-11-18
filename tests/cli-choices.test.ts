import { describe, expect, it } from 'vitest'
import { cliChoices, selectionForChoice } from '../src/client/choices.ts'
import type { DirectoryState } from '../src/client/choices.ts'

const DEEPSEEK = {
  id: 'deepseek-official',
  name: 'DeepSeek',
  models: [
    { id: 'flash', name: 'Flash' },
    { id: 'pro', name: 'Pro' },
  ],
}
const OPENCODE = {
  id: 'cli-opencode',
  name: 'OpenCode',
  models: [
    { id: 'default', name: 'Beam（默认）' },
    { id: 'beam', name: 'Beam' },
  ],
}
const CODEX = { id: 'cli-codex', name: 'Codex', models: [{ id: 'default', name: 'Codex' }] }
const ACCOUNT = { id: 'deepseek-account', name: 'deepseek-account', models: [{ id: 'chat', name: 'Chat' }] }
// A provider the user added in the harness's own model settings.
const CUSTOM = { id: 'teamo', name: 'Teamo', models: [{ id: 'm1', name: 'M1' }] }

const state = (fields: Partial<DirectoryState> = {}): DirectoryState => ({
  groups: [DEEPSEEK, OPENCODE, CODEX],
  current: { provider: 'deepseek-official', model: 'flash' },
  ...fields,
})

describe('cliChoices', () => {
  it('lists every provider in the directory order', () => {
    expect(cliChoices(state()).items).toEqual([
      { id: 'deepseek-official', label: 'DeepSeek' },
      { id: 'cli-opencode', label: 'OpenCode' },
      { id: 'cli-codex', label: 'Codex' },
    ])
  })

  // The model menu already lists every provider the harness runs, so the switcher offers
  // the harness as one entry instead of repeating each of them.
  it('folds every provider that is not a CLI into one DeepSeek entry', () => {
    const groups = [ACCOUNT, CUSTOM, DEEPSEEK, OPENCODE, CODEX]
    expect(cliChoices(state({ groups })).items).toEqual([
      { id: 'deepseek-official', label: 'DeepSeek' },
      { id: 'cli-opencode', label: 'OpenCode' },
      { id: 'cli-codex', label: 'Codex' },
    ])
  })

  it('stands the first harness provider in for the official one when it is missing', () => {
    const groups = [OPENCODE, ACCOUNT, CUSTOM]
    expect(cliChoices(state({ groups, current: null })).items).toEqual([
      { id: 'cli-opencode', label: 'OpenCode' },
      { id: 'deepseek-account', label: 'DeepSeek' },
    ])
  })

  it('marks the harness entry while the session is on any harness provider', () => {
    const groups = [ACCOUNT, CUSTOM, DEEPSEEK, OPENCODE]
    const choices = cliChoices(state({ groups, current: { provider: 'teamo', model: 'm1' } }))
    expect(choices.currentId).toBe('deepseek-official')
    expect(choices.currentLabel).toBe('DeepSeek')
  })

  it('marks the current provider', () => {
    const choices = cliChoices(state({ current: { provider: 'cli-codex', model: 'default' } }))
    expect(choices.currentId).toBe('cli-codex')
    expect(choices.currentLabel).toBe('Codex')
  })

  // Without any CLI this button would only repeat the model menu.
  it('stays hidden when no CLI is available', () => {
    expect(cliChoices(state({ groups: [DEEPSEEK] })).visible).toBe(false)
    expect(cliChoices(state({ groups: [] })).visible).toBe(false)
    expect(cliChoices(state()).visible).toBe(true)
  })

  it('has no current choice before the session has a model', () => {
    const choices = cliChoices(state({ current: null }))
    expect(choices.currentId).toBeUndefined()
    expect(choices.currentLabel).toBeUndefined()
  })

  it('does not name a provider that is not in the catalog', () => {
    expect(cliChoices(state({ current: { provider: 'gone', model: 'x' } })).currentLabel).toBeUndefined()
  })
})

describe('selectionForChoice', () => {
  it('starts a CLI on its own default model', () => {
    expect(selectionForChoice(state(), 'cli-opencode')).toEqual({ provider: 'cli-opencode', model: 'default' })
  })

  it('starts any other provider on its first model', () => {
    const current = { provider: 'cli-codex', model: 'default' }
    expect(selectionForChoice(state({ current }), 'deepseek-official')).toEqual({
      provider: 'deepseek-official',
      model: 'flash',
    })
  })

  it('does nothing when the provider is already selected', () => {
    expect(selectionForChoice(state(), 'deepseek-official')).toBeUndefined()
  })

  // Picking a harness provider is the model menu's job; the switcher only enters the harness.
  it('keeps the harness provider the session is already on', () => {
    const groups = [ACCOUNT, CUSTOM, DEEPSEEK, OPENCODE]
    const current = { provider: 'teamo', model: 'm1' }
    expect(selectionForChoice(state({ groups, current }), 'deepseek-official')).toBeUndefined()
  })

  it('does nothing for an unknown provider or one with no models', () => {
    expect(selectionForChoice(state(), 'gone')).toBeUndefined()
    const empty = { id: 'empty', name: 'Empty', models: [] }
    expect(selectionForChoice(state({ groups: [DEEPSEEK, empty] }), 'empty')).toBeUndefined()
  })
})
