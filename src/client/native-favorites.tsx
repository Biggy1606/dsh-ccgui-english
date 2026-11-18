/**
 * Favorite model shortcuts inside the harness's own model menu.
 * @module dsh-ccgui/client/native-favorites
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { DirectorySelection, DirectoryState } from './choices.ts'
import type { FavoriteModel, FavoriteModels, MenuRow, MenuSection } from './favorite-models.ts'
import { sameModel } from './favorite-models.ts'
import { useStore } from './store.ts'
import type { Store } from './store.ts'

interface NativeFavoritesProps {
  readonly available: boolean
  readonly directory: Store<DirectoryState>
  readonly favorites: FavoriteModels
  readonly select: (selection: DirectorySelection) => Promise<{ error?: { message?: string } }>
  readonly locked: boolean
  readonly dismiss: () => void
  readonly reportFailure: (message: string) => void
}

const GROUP_CLASS = 'dsh-cli-native-favorites'
const ROW_CLASS = 'dsh-cli-native-favorites-row'
const LABEL_CLASS = 'dsh-cli-native-favorites-label'
const REMOVE_CLASS = 'dsh-cli-native-favorites-remove'

// Metrics follow the harness's own option rows (34px, radius-md, 13px/20px), so the section
// reads as part of the menu rather than as another plugin's list.
export const NATIVE_FAVORITES_STYLES = `
.${GROUP_CLASS} { border-top: 1px solid var(--dsw-alias-border-l1); padding: 4px 0; font-size: 13px; line-height: 20px; }
.${LABEL_CLASS} { padding: 4px 12px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.${ROW_CLASS} { display: flex; align-items: center; gap: 4px; padding: 0 4px; }
.${ROW_CLASS} > button { border: 0; border-radius: var(--dsw-radius-md); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; }
.${ROW_CLASS} > button:first-child {
  flex: 1; min-width: 0; display: block; height: 34px; padding: 0 8px; line-height: 34px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
}
@media (hover: hover) { .${ROW_CLASS} > button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); } }
.${ROW_CLASS} > button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
.${ROW_CLASS} > button:disabled { opacity: .55; cursor: default; }
.${REMOVE_CLASS} { flex: none; width: 34px; height: 34px; padding: 0; }
`

function currentModel(state: DirectoryState): { section: Pick<MenuSection, 'id' | 'name'>; row: MenuRow } | undefined {
  const current = state.current
  if (current === null) return undefined
  const group = state.groups.find((candidate) => candidate.id === current.provider)
  const model = group?.models.find((candidate) => candidate.id === current.model)
  if (group === undefined || model === undefined) return undefined
  return {
    section: { id: group.id, name: group.name },
    row: { provider: group.id, model: model.id, name: model.name },
  }
}

function FavoriteToggle({
  current,
  favorite,
  favorites,
  disabled,
}: {
  readonly current: NonNullable<ReturnType<typeof currentModel>>
  readonly favorite: boolean
  readonly favorites: FavoriteModels
  readonly disabled: boolean
}): ReactElement {
  return (
    <div className={ROW_CLASS}>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={favorite}
        aria-label={favorite ? 'Remove current model from favorites' : 'Add current model to favorites'}
        disabled={disabled}
        onClick={() => {
          favorites.setFavorite(current.section, current.row, !favorite)
        }}
      >
        {favorite ? '★ Favorited' : '☆ Add to favorites'}
      </button>
    </div>
  )
}

function FavoriteShortcut({
  entry,
  state,
  favorites,
  disabled,
  choose,
}: {
  readonly entry: FavoriteModel
  readonly state: DirectoryState
  readonly favorites: FavoriteModels
  readonly disabled: boolean
  readonly choose: (row: MenuRow) => void
}): ReactElement {
  const { row, section } = entry
  const availableModel = state.groups.some(
    (group) => group.id === row.provider && group.models.some((model) => model.id === row.model),
  )
  const missingLabel = state.status === 'loading' ? ' · Loading…' : ' · Unavailable'
  return (
    <div className={ROW_CLASS}>
      <button
        type="button"
        role="menuitem"
        disabled={disabled || !availableModel}
        onClick={() => {
          choose(row)
        }}
      >
        {row.name} · {section.name}
        {availableModel ? '' : missingLabel}
      </button>
      <button
        type="button"
        className={REMOVE_CLASS}
        aria-label={`Remove ${row.name} from ${section.name} favorites`}
        disabled={disabled}
        onClick={() => {
          favorites.setFavorite(section, row, false)
        }}
      >
        ★
      </button>
    </div>
  )
}

/** Add the current model and select saved favorites without replacing native menu controls. */
export function NativeFavorites(props: NativeFavoritesProps): ReactElement | null {
  const { available, directory, favorites, select, locked, dismiss, reportFailure } = props
  const state = useStore(directory)
  const saved = useStore(favorites)
  const [pending, setPending] = useState(false)
  const current = currentModel(state)
  // Nothing to offer means nothing to show: an empty group would leave a separator line.
  if (!available || (current === undefined && saved.length === 0)) return null
  const isFavorite = current !== undefined && saved.some((entry) => sameModel(entry.row, current.row))
  const choose = (row: MenuRow): void => {
    setPending(true)
    void select({ provider: row.provider, model: row.model })
      .then(
        (result) => {
          if (result.error !== undefined) reportFailure(result.error.message ?? 'Could not select model')
          else dismiss()
        },
        (error: unknown) => {
          reportFailure(error instanceof Error ? error.message : String(error))
        },
      )
      .finally(() => {
        setPending(false)
      })
  }
  return (
    <div className={GROUP_CLASS} role="group" aria-label="Favorite models">
      {current !== undefined && (
        <FavoriteToggle current={current} favorite={isFavorite} favorites={favorites} disabled={locked || pending} />
      )}
      {saved.length > 0 && <div className={LABEL_CLASS}>Favorites</div>}
      {saved.map((entry) => (
        <FavoriteShortcut
          key={`${entry.row.provider}/${entry.row.model}`}
          entry={entry}
          state={state}
          favorites={favorites}
          disabled={locked || pending}
          choose={choose}
        />
      ))}
    </div>
  )
}
