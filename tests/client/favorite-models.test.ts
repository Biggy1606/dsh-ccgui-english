/** Tests persistent favorites and catalog-aware model section arrangement. */
import { describe, expect, it } from 'vitest'
import {
  arrangeFavoriteSections,
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

  it('sorts favorites per provider section without mutating and preserves metadata', () => {
    const plain = { ...row, model: 'vendor/b', name: 'B' }
    const sections = [{ ...section, rows: [plain, row, other] }]
    const result = arrangeFavoriteSections(sections, [{ section, row }], () => true)
    expect(result[0]?.rows.map((item) => [item.model, item.provider, item.favorite])).toEqual([
      ['vendor/a', 'cli-one', true],
      ['vendor/b', 'cli-one', false],
      ['vendor/a', 'cli-two', false],
    ])
    expect(result[0]?.rows[0]).toMatchObject({ ...row, unavailable: false })
    expect(sections[0]?.rows).toEqual([plain, row, other])
  })

  it('hides absent favorites until provider readiness and restores the current section', () => {
    const favorite = { section, row }
    const providerSection = { id: 'cli-one', name: 'One', rows: [{ ...row, model: 'b' }] }
    expect(arrangeFavoriteSections([providerSection], [favorite], () => false)[0]?.rows).toHaveLength(1)
    const result = arrangeFavoriteSections([providerSection], [favorite], () => true)
    expect(result).toHaveLength(1)
    expect(result[0]?.rows[0]).toEqual({ ...row, favorite: true, unavailable: true })
    expect(arrangeFavoriteSections([], [favorite], () => true)).toEqual([
      { ...section, rows: [{ ...row, favorite: true, unavailable: true }] },
    ])
    const vendorSection = { ...section, rows: [] }
    expect(arrangeFavoriteSections([vendorSection], [{ section: providerSection, row }], () => true)).toHaveLength(1)
  })
})
