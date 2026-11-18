// @vitest-environment jsdom
/** The native DSH model menu keeps its own controls while offering favorite shortcuts. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirectoryState } from '../../src/client/choices.ts'
import { createFavoriteModels } from '../../src/client/favorite-models.ts'
import { NativeFavorites } from '../../src/client/native-favorites.tsx'
import { createStore } from '../fixtures/client-store.ts'

const native: DirectoryState = {
  status: 'ready',
  current: { provider: 'deepseek-official', model: 'flash' },
  groups: [
    { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'flash', name: 'Flash' }] },
    { id: 'cli-codex', name: 'Codex', models: [{ id: 'default', name: 'Codex' }] },
  ],
}

afterEach(cleanup)

describe('native model favorites', () => {
  it('stars the current native model and offers saved models as direct selections', async () => {
    const favorites = createFavoriteModels({ getItem: () => null, setItem: () => undefined })
    favorites.setFavorite(
      { id: 'cli-codex', name: 'Codex' },
      { provider: 'cli-codex', model: 'default', name: 'Codex' },
      true,
    )
    const select = vi.fn().mockResolvedValue({})
    const dismiss = vi.fn()
    render(
      <NativeFavorites
        available
        directory={createStore(native)}
        favorites={favorites}
        select={select}
        locked={false}
        dismiss={dismiss}
        reportFailure={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: '☆ Add current model to favorites' }))
    expect(favorites.getSnapshot().map((entry) => entry.row.name)).toEqual(['Codex', 'Flash'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Codex · Codex' }))
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({ provider: 'cli-codex', model: 'default' })
      expect(dismiss).toHaveBeenCalledOnce()
    })
  })

  it('keeps unavailable favorites removable and hides on CLI sessions', () => {
    const favorites = createFavoriteModels({ getItem: () => null, setItem: () => undefined })
    favorites.setFavorite({ id: 'gone', name: 'Gone' }, { provider: 'gone', model: 'x', name: 'Missing' }, true)
    const directory = createStore(native)
    const select = vi.fn()
    const { rerender } = render(
      <NativeFavorites
        available
        directory={directory}
        favorites={favorites}
        select={select}
        locked={false}
        dismiss={vi.fn()}
        reportFailure={vi.fn()}
      />,
    )
    expect(screen.getByRole('menuitem', { name: 'Missing · Gone · Unavailable' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Missing from favorites' }))
    expect(favorites.getSnapshot()).toEqual([])
    directory.set({ ...native, current: { provider: 'cli-codex', model: 'default' } })
    expect(screen.queryByRole('group', { name: 'Favorite models' })).toBeNull()
    rerender(
      <NativeFavorites
        available={false}
        directory={directory}
        favorites={favorites}
        select={select}
        locked={false}
        dismiss={vi.fn()}
        reportFailure={vi.fn()}
      />,
    )
    expect(select).not.toHaveBeenCalled()
  })
})
