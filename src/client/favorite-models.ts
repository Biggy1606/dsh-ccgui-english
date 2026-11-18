/**
 * The user's favorite models, persisted in the browser and shared by every picker surface.
 * A favorite is identified by the provider and the model id together; the section it was
 * saved under is kept only for display, because the catalog can rename or drop providers.
 * @module dsh-ccgui/client/favorite-models
 */
import type { DirectoryReasoning } from './choices.ts'
import type { Store } from './store.ts'

/** One model row, which only the provider and the model id together identify. */
export interface MenuRow {
  readonly provider: string
  readonly model: string
  readonly name: string
  /** Compact label shown beside the name, e.g. a CLI's usage cost multiplier. */
  readonly description?: string
  readonly reasoning?: DirectoryReasoning
}

/** One provider's rows in the harness's own model picker. */
export interface MenuSection {
  readonly id: string
  readonly name: string
  readonly rows: readonly MenuRow[]
}

export interface FavoriteModel {
  readonly section: Pick<MenuSection, 'id' | 'name'>
  readonly row: MenuRow
}

export interface FavoriteStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface FavoriteModels extends Store<readonly FavoriteModel[]> {
  setFavorite(section: Pick<MenuSection, 'id' | 'name'>, row: MenuRow, favorite: boolean): void
}

export const FAVORITE_MODELS_STORAGE_KEY = 'dsh-ccgui.favorite-models'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRow(value: unknown): MenuRow | undefined {
  if (
    !record(value) ||
    typeof value.provider !== 'string' ||
    typeof value.model !== 'string' ||
    typeof value.name !== 'string'
  )
    return undefined
  const description = typeof value.description === 'string' ? value.description : undefined
  const reasoning = value.reasoning
  if (!record(reasoning) || !Array.isArray(reasoning.efforts)) {
    return {
      provider: value.provider,
      model: value.model,
      name: value.name,
      ...(description === undefined ? {} : { description }),
    }
  }
  const efforts = reasoning.efforts.flatMap((effort: unknown) =>
    record(effort) && typeof effort.id === 'string' && typeof effort.name === 'string'
      ? [{ id: effort.id, name: effort.name }]
      : [],
  )
  const defaultEffort = typeof reasoning.defaultEffort === 'string' ? reasoning.defaultEffort : undefined
  return {
    provider: value.provider,
    model: value.model,
    name: value.name,
    ...(description === undefined ? {} : { description }),
    reasoning: { efforts, ...(defaultEffort === undefined ? {} : { defaultEffort }) },
  }
}

/**
 * Read stored favorites, ignoring malformed entries and duplicates.
 * @param raw - the stored JSON, or null when nothing is stored.
 * @returns the favorites; empty ones add nothing to the picker.
 */
export function parseFavoriteModels(raw: string | null): readonly FavoriteModel[] {
  if (raw === null) return []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (_error: unknown) {
    // A corrupt preference should cost the user their favorites, not the plugin's start.
    return []
  }
  if (!Array.isArray(value)) return []
  return value.reduce<FavoriteModel[]>((items, item: unknown) => {
    if (
      !record(item) ||
      !record(item.section) ||
      typeof item.section.id !== 'string' ||
      typeof item.section.name !== 'string'
    )
      return items
    const row = parseRow(item.row)
    if (row === undefined || items.some((entry) => sameModel(entry.row, row))) return items
    return [...items, { section: { id: item.section.id, name: item.section.name }, row }]
  }, [])
}

/**
 * Tell whether two rows name the same model; the provider and the id together identify it.
 * @param left - one row.
 * @param right - another row.
 * @returns true when both name the same model.
 */
export function sameModel(left: MenuRow, right: MenuRow): boolean {
  return left.provider === right.provider && left.model === right.model
}

/**
 * @param storage - where the favorites are kept; the browser's localStorage in the harness.
 * @returns the favorites, loaded from storage.
 */
export function createFavoriteModels(storage: FavoriteStorage): FavoriteModels {
  let favorites: readonly FavoriteModel[] = []
  try {
    favorites = parseFavoriteModels(storage.getItem(FAVORITE_MODELS_STORAGE_KEY))
  } catch (_error: unknown) {
    // Storage can be blocked (private modes, policies); the session then keeps them in memory.
  }
  let listeners: readonly (() => void)[] = []
  return {
    getSnapshot: () => favorites,
    subscribe(listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener)
      }
    },
    setFavorite(section, row, favorite) {
      const existing = favorites.some((entry) => sameModel(entry.row, row))
      if (existing === favorite) return
      favorites = favorite ? [...favorites, { section, row }] : favorites.filter((entry) => !sameModel(entry.row, row))
      try {
        storage.setItem(FAVORITE_MODELS_STORAGE_KEY, JSON.stringify(favorites))
      } catch (_error: unknown) {
        // The change still applies for this run; only remembering it across restarts is lost.
      }
      for (const listener of listeners) listener()
    },
  }
}
