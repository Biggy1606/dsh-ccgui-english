/**
 * Persistent model favorites and their section metadata, independent of the model menu UI.
 * @module dsh-ccgui/client/favorite-models
 */
import type { MenuRow, MenuSection } from './menu-models.ts'
import type { Store } from './store.ts'

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

interface FavoriteRow extends MenuRow {
  readonly favorite: boolean
  readonly unavailable: boolean
}

export interface FavoriteSection extends Omit<MenuSection, 'rows'> {
  readonly rows: readonly FavoriteRow[]
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

/** Parse persisted favorites, ignoring malformed entries and duplicate identities. */
export function parseFavoriteModels(raw: string | null): readonly FavoriteModel[] {
  if (raw === null) return []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (_error: unknown) {
    // A corrupt preference must not prevent the menu from opening.
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

function sameModel(left: MenuRow, right: MenuRow): boolean {
  return left.provider === right.provider && left.model === right.model
}

/** Create an observable store backed by localStorage when it is available. */
export function createFavoriteModels(storage: FavoriteStorage): FavoriteModels {
  let favorites: readonly FavoriteModel[] = []
  try {
    favorites = parseFavoriteModels(storage.getItem(FAVORITE_MODELS_STORAGE_KEY))
  } catch (_error: unknown) {
    // Blocked storage leaves an in-memory store for this session.
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
        // Keep the change in memory when storage is blocked.
      }
      for (const listener of listeners) listener()
    },
  }
}

function sectionFor(entry: FavoriteModel, sections: readonly MenuSection[]): Pick<MenuSection, 'id' | 'name'> {
  const { provider, model } = entry.row
  const vendor = model.split('/')[0]
  return (
    sections.find((section) => section.id === `${provider}/${vendor}` && model.includes('/')) ??
    sections.find((section) => section.id === provider) ??
    sections.find((section) => section.id === entry.section.id) ??
    entry.section
  )
}

/** Arrange favorites within their sections; hide absence until the provider catalog is authoritative. */
export function arrangeFavoriteSections(
  sections: readonly MenuSection[],
  favorites: readonly FavoriteModel[],
  isProviderReady: (provider: string) => boolean,
): readonly FavoriteSection[] {
  const rows = sections.flatMap((section) => section.rows)
  const missing = favorites
    .filter((entry) => isProviderReady(entry.row.provider) && !rows.some((row) => sameModel(row, entry.row)))
    .map((entry) => ({ ...entry, section: sectionFor(entry, sections) }))
  const extraSections = missing
    .filter((entry) => !sections.some((section) => section.id === entry.section.id))
    .filter(
      (entry, index, entries) => entries.findIndex((candidate) => candidate.section.id === entry.section.id) === index,
    )
    .map((entry) => ({ ...entry.section, rows: [] }))
  return [...sections, ...extraSections].map((section) => {
    const marked = section.rows.map((row) => ({
      ...row,
      favorite: favorites.some((entry) => sameModel(entry.row, row)),
      unavailable: false,
    }))
    const absent = missing
      .filter((entry) => entry.section.id === section.id)
      .map((entry) => ({ ...entry.row, favorite: true, unavailable: true }))
    return {
      ...section,
      rows: [...marked.filter((row) => row.favorite), ...absent, ...marked.filter((row) => !row.favorite)],
    }
  })
}
