/** Tests persistent favorites and catalog-aware model section arrangement. */
import { describe, expect, it } from 'vitest'
import {
  createFavoriteModels,
  FAVORITE_MODELS_STORAGE_KEY,
  parseFavoriteModels,
} from '../../src/client/favorite-models.ts'
import type { FavoriteStorage } from '../../src/client/favorite-models.ts'

const section = { id: 'cli-one/vendor', name: 'One · vendor' }
const row = {
  provider: 'cli-one',
  model: 'vendor/a',
  name: 'A',
  description: 'x2',
  reasoning: { efforts: [{ id: 'low', name: 'Low' }] },
}
const other = { provider: 'cli-two', model: 'vendor/a', name: 'Other' }

function memory(): FavoriteStorage {
  let data: Record<string, string> = {}
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data = { ...data, [key]: value }
    },
  }
}

describe('favorite models', () => {
  it('persists identities and metadata, notifies on changes, and tolerates blocked storage', () => {
    const storage = memory()
    const store = createFavoriteModels(storage)
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })
    store.setFavorite(section, row, true)
    store.setFavorite(section, row, true)
    store.setFavorite(section, other, true)
    expect(createFavoriteModels(storage).getSnapshot()).toEqual([
      { section, row },
      { section, row: other },
    ])
    expect(calls).toBe(2)
    unsubscribe()
    store.setFavorite(section, row, false)
    expect(calls).toBe(2)
    expect(store.getSnapshot()).toEqual([{ section, row: other }])
    const blocked = createFavoriteModels({
      getItem: () => {
        throw Error()
      },
      setItem: () => {
        throw Error()
      },
    })
    blocked.setFavorite(section, row, true)
    expect(blocked.getSnapshot()).toEqual([{ section, row }])
    expect(storage.getItem(FAVORITE_MODELS_STORAGE_KEY)).not.toBeNull()
  })

  it('ignores malformed data and keeps native DSH favorites', () => {
    expect(parseFavoriteModels('{')).toEqual([])
    expect(parseFavoriteModels(null)).toEqual([])
    expect(parseFavoriteModels('{}')).toEqual([])
    expect(
      parseFavoriteModels(
        JSON.stringify([
          { section, row },
          { section, row },
          { section, row: {} },
          { section, row: { ...row, provider: 'dsh' } },
        ]),
      ),
    ).toEqual([
      { section, row },
      { section, row: { ...row, provider: 'dsh' } },
    ])
    const store = createFavoriteModels(memory())
    store.setFavorite(section, { ...row, provider: 'dsh' }, true)
    expect(store.getSnapshot()).toEqual([{ section, row: { ...row, provider: 'dsh' } }])
  })
})
