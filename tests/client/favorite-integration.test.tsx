// @vitest-environment jsdom
/// <reference lib="dom" />

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DirectoryState } from '../../src/client/choices.ts'
import { createFavoriteModels } from '../../src/client/favorite-models.ts'
import { CliModelMenu } from '../../src/client/model-menu.tsx'
import { createStore } from '../fixtures/client-store.ts'

const initial: DirectoryState = {
  status: 'ready',
  current: { provider: 'cli-one', model: 'default' },
  groups: [
    {
      id: 'cli-one',
      name: 'One',
      models: [
        { id: 'default', name: 'Default' },
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ],
    },
    { id: 'cli-two', name: 'Two', models: [{ id: 'a', name: 'Other Alpha' }] },
    { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'a', name: 'Native' }] },
  ],
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('model favorites integration', () => {
  it('stars within a CLI group, retains a missing model and removes it without selecting', () => {
    let saved: string | null = null
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value
      },
    }
    const favorites = createFavoriteModels(storage)
    const directory = createStore(initial)
    const select = vi.fn().mockResolvedValue({})
    render(
      <CliModelMenu
        available
        directory={directory}
        favorites={favorites}
        load={vi.fn()}
        select={select}
        session={undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Select model/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Beta to favorites' }))
    expect(select).not.toHaveBeenCalled()
    expect(screen.getAllByRole('menuitemradio').map((row) => row.getAttribute('title'))).toEqual([
      'Beta',
      'Default',
      'Alpha',
      'Native',
      'Other Alpha',
    ])
    expect(screen.getByRole('button', { name: 'Add Native to favorites' })).toBeTruthy()
    expect(createFavoriteModels(storage).getSnapshot()).toHaveLength(1)
    directory.set({
      ...initial,
      groups: initial.groups.map((group) =>
        group.id === 'cli-one' ? { ...group, models: group.models.filter((model) => model.id !== 'b') } : group,
      ),
    })
    const missing = screen.getByRole('menuitemradio', { name: /Beta/ })
    expect(missing.hasAttribute('disabled')).toBe(true)
    expect(missing.textContent).toContain('Unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beta from favorites' }))
    expect(screen.queryByRole('menuitemradio', { name: /Beta/ })).toBeNull()
    expect(favorites.getSnapshot()).toHaveLength(0)
    expect(select).not.toHaveBeenCalled()
  })

  it('waits for a confirmed catalog before marking a missing favorite unavailable', () => {
    const favorites = createFavoriteModels({ getItem: () => null, setItem: () => undefined })
    favorites.setFavorite({ id: 'cli-one', name: 'One' }, { provider: 'cli-one', model: 'b', name: 'Beta' }, true)
    const groups = initial.groups.map((group) =>
      group.id === 'cli-one' ? { ...group, models: group.models.filter((model) => model.id !== 'b') } : group,
    )
    const directory = createStore<DirectoryState>({ ...initial, status: 'loading', groups })
    render(
      <CliModelMenu
        available
        directory={directory}
        favorites={favorites}
        load={vi.fn()}
        select={vi.fn()}
        session={undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Select model/ }))
    expect(screen.queryByRole('menuitemradio', { name: /Beta/ })).toBeNull()
    expect(favorites.getSnapshot()).toHaveLength(1)
    directory.set({ ...initial, status: 'ready', groups })
    expect(screen.getByRole('menuitemradio', { name: /Beta/ }).textContent).toContain('Unavailable')
    directory.set(initial)
    expect(screen.getByRole('menuitemradio', { name: /Beta/ }).hasAttribute('disabled')).toBe(false)
  })

  it('keeps favorites removable when an entire CLI disappears', () => {
    const favorites = createFavoriteModels({ getItem: () => null, setItem: () => undefined })
    favorites.setFavorite(
      { id: 'cli-two', name: 'Two' },
      { provider: 'cli-two', model: 'a', name: 'Other Alpha' },
      true,
    )
    const directory = createStore<DirectoryState>({
      ...initial,
      groups: initial.groups.filter((group) => group.id !== 'cli-two'),
    })
    render(
      <CliModelMenu
        available
        directory={directory}
        favorites={favorites}
        load={vi.fn()}
        select={vi.fn()}
        session={undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Select model/ }))
    expect(screen.getByRole('menuitemradio', { name: /Other Alpha/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Other Alpha from favorites' }))
    expect(favorites.getSnapshot()).toHaveLength(0)
  })
})
