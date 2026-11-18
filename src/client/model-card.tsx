/// <reference lib="dom" />

/**
 * The open model menu: the search field, the rows under their providers' headings and the
 * card around them.
 * @module dsh-ccgui/client/model-card
 */

import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactElement, RefObject } from 'react'
import {
  IconCheckOutlineRegular,
  Input,
  MenuGroup,
  MenuSurface,
  observeStickyMenuGroups,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { compactDescription } from '../constants.ts'
import type { DirectorySelection } from './choices.ts'
import { MarkGlyph } from './marks.tsx'
import { isRow, rowCount } from './menu-models.ts'
import type { MenuModels, MenuRow, MenuSection } from './menu-models.ts'
import { modelMarkOf } from './model-marks.ts'
import {
  HINT_CLASS,
  MENU_CLASS,
  ROW_ACTIVE_CLASS,
  ROW_CHECK_CLASS,
  ROW_CLASS,
  ROW_MARK_CLASS,
  ROW_DESCRIPTION_CLASS,
  ROW_NAME_CLASS,
  ROWS_CLASS,
  ROW_WRAPPER_CLASS,
  ROW_FAVORITE_CLASS,
  SEARCH_CLASS,
  SEARCH_INPUT_CLASS,
} from './model-menu-styles.ts'

/** The harness's seat offers search from the same size, so the two menus agree. */
export const SEARCH_ABOVE = 4
const MENU_LABEL = 'Models'
const SELECTION_LABEL = 'Model selection'
const SEARCH_LABEL = 'Search models…'
const NO_MATCH_LABEL = 'No matching models.'
const NO_MODELS_LABEL = 'No models available'
const ROW_MARK_SIZE = 14

interface ModelRowProps {
  readonly domId: string
  readonly model: MenuRow
  readonly selected: boolean
  readonly settling: boolean
  readonly active: boolean
  readonly busy: boolean
  readonly favorite: boolean | undefined
  readonly unavailable: boolean
  readonly onHover: () => void
  readonly onChoose: () => void
  readonly onToggleFavorite: () => void
}

function FavoriteButton({
  model,
  favorite,
  onToggleFavorite,
}: Pick<ModelRowProps, 'model' | 'favorite' | 'onToggleFavorite'>): ReactElement | null {
  if (favorite === undefined) return null
  return (
    <button
      type="button"
      className={ROW_FAVORITE_CLASS}
      aria-label={`${favorite ? 'Remove' : 'Add'} ${model.name} ${favorite ? 'from' : 'to'} favorites`}
      aria-pressed={favorite}
      onClick={(event) => {
        const button = event.currentTarget
        const card = button.closest('[aria-label="Model selection"]')
        const search = card?.querySelector<HTMLInputElement>('input')
        const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-controls]')).find(
          (item) => item.getAttribute('aria-controls') === card?.id,
        )
        onToggleFavorite()
        queueMicrotask(() => {
          if (!button.isConnected) (search?.isConnected === true ? search : trigger)?.focus()
        })
      }}
    >
      {favorite ? '★' : '☆'}
    </button>
  )
}

function ModelRow({
  domId,
  model,
  selected,
  settling,
  active,
  busy,
  favorite,
  unavailable,
  onHover,
  onChoose,
  onToggleFavorite,
}: ModelRowProps): ReactElement {
  const check = selected ? <IconCheckOutlineRegular /> : null
  const mark = modelMarkOf(model)
  // Prose would crowd the row and push the check mark aside; see compactDescription.
  const detail = compactDescription(model.description)
  return (
    <div className={ROW_WRAPPER_CLASS}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        id={domId}
        tabIndex={-1}
        title={model.name}
        className={active ? `${ROW_CLASS} ${ROW_ACTIVE_CLASS}` : ROW_CLASS}
        disabled={busy || unavailable}
        onMouseMove={active || busy ? undefined : onHover}
        onClick={onChoose}
      >
        {/* The slot stays when there is no mark, so every name starts at the same place. */}
        <span className={ROW_MARK_CLASS}>
          {mark === undefined ? null : <MarkGlyph id={mark} size={ROW_MARK_SIZE} />}
        </span>
        <span className={ROW_NAME_CLASS}>{model.name}</span>
        {detail !== undefined && (
          <span className={ROW_DESCRIPTION_CLASS} title={detail}>
            {detail}
          </span>
        )}
        {unavailable && <span className={ROW_DESCRIPTION_CLASS}>Unavailable</span>}
        <span className={ROW_CHECK_CLASS}>{settling ? <StateDot state="ongoing" /> : check}</span>
      </button>
      <FavoriteButton model={model} favorite={favorite} onToggleFavorite={onToggleFavorite} />
    </div>
  )
}

export interface ModelCardProps {
  readonly id: string
  readonly models: MenuModels
  /** The sections left after search. */
  readonly sections: readonly MenuSection[]
  readonly active: number
  readonly pending: DirectorySelection | null
  readonly query: string
  readonly anchorStyle: CSSProperties
  readonly cardRef: RefObject<HTMLDivElement>
  readonly searchRef: RefObject<HTMLInputElement>
  readonly onQuery: (query: string) => void
  readonly onHighlight: (index: number) => void
  readonly onChoose: (row: MenuRow) => void
  readonly isFavorite?: (row: MenuRow) => boolean | undefined
  readonly isUnavailable?: (row: MenuRow) => boolean
  readonly onToggleFavorite?: (row: MenuRow) => void
}

interface ModelSearchProps {
  readonly id: string
  readonly active: number
  readonly query: string
  readonly busy: boolean
  readonly searchRef: RefObject<HTMLInputElement>
  readonly onQuery: (query: string) => void
}

function ModelSearch({ id, active, query, busy, searchRef, onQuery }: ModelSearchProps): ReactElement {
  return (
    <div className={SEARCH_CLASS}>
      <Input
        ref={searchRef}
        className={SEARCH_INPUT_CLASS}
        type="text"
        role="searchbox"
        aria-label={SEARCH_LABEL}
        aria-controls={`${id}-rows`}
        aria-activedescendant={active < 0 ? undefined : `${id}-model-${active}`}
        placeholder={SEARCH_LABEL}
        value={query}
        readOnly={busy}
        onChange={(event) => {
          onQuery(event.target.value)
        }}
      />
    </div>
  )
}

type ModelRowsProps = Pick<
  ModelCardProps,
  | 'id'
  | 'models'
  | 'sections'
  | 'active'
  | 'pending'
  | 'onHighlight'
  | 'onChoose'
  | 'isFavorite'
  | 'isUnavailable'
  | 'onToggleFavorite'
>

function ModelSection(props: ModelRowsProps & { readonly section: MenuSection; readonly start: number }): ReactElement {
  const {
    id,
    models,
    active,
    pending,
    onHighlight,
    onChoose,
    isFavorite,
    isUnavailable,
    onToggleFavorite,
    section,
    start,
  } = props
  return (
    <MenuGroup label={section.name}>
      {section.rows.map((row, rowIndex) => {
        const index = start + rowIndex
        return (
          <ModelRow
            key={`${row.provider}/${row.model}`}
            domId={`${id}-model-${index}`}
            model={row}
            selected={isRow(row, models.current)}
            settling={isRow(row, pending)}
            active={index === active}
            busy={pending !== null}
            favorite={onToggleFavorite === undefined ? undefined : isFavorite?.(row)}
            unavailable={isUnavailable?.(row) ?? false}
            onToggleFavorite={() => {
              onToggleFavorite?.(row)
            }}
            onHover={() => {
              onHighlight(index)
            }}
            onChoose={() => {
              onChoose(row)
            }}
          />
        )
      })}
    </MenuGroup>
  )
}

/** Indexes run across the sections, so the highlight and the arrows ignore the headings. */
function ModelRows(props: ModelRowsProps): ReactElement {
  const { id, sections } = props
  const starts = sections.map((_section, index) => rowCount(sections.slice(0, index)))
  const viewportRef = useRef<HTMLDivElement>(null)
  // MenuGroup keeps its heading visible; the host observer adds the pinned background only
  // while a heading actually crosses the scrolling row area.
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    return observeStickyMenuGroups(viewport)
  }, [sections])
  return (
    <div
      ref={viewportRef}
      id={`${id}-rows`}
      className={`${ROWS_CLASS} scrollable`}
      role="menu"
      aria-label={MENU_LABEL}
      hidden={sections.length === 0}
    >
      {sections.map((section, index) => (
        <ModelSection key={section.id} {...props} section={section} start={starts[index] ?? 0} />
      ))}
    </div>
  )
}

function emptyLabel(models: MenuModels): string {
  return rowCount(models.sections) === 0 ? NO_MODELS_LABEL : NO_MATCH_LABEL
}

/**
 * Render the open menu.
 * @param props - the rows to show and what to do with them.
 * @returns the menu surface.
 */
export function ModelCard(props: ModelCardProps): ReactElement {
  const { id, models, sections, active, pending, query, anchorStyle, cardRef, searchRef, onQuery } = props
  const busy = pending !== null
  return (
    <MenuSurface
      ref={cardRef}
      id={`${id}-menu`}
      className={MENU_CLASS}
      style={anchorStyle}
      role="group"
      aria-label={SELECTION_LABEL}
    >
      {rowCount(models.sections) > SEARCH_ABOVE && (
        <ModelSearch id={id} active={active} query={query} busy={busy} searchRef={searchRef} onQuery={onQuery} />
      )}
      <ModelRows {...props} />
      {sections.length === 0 && (
        <div className={HINT_CLASS} role="status">
          {emptyLabel(models)}
        </div>
      )}
      {models.unlisted !== undefined && (
        <div className={HINT_CLASS} role="status">{`The model list for ${models.unlisted} has not loaded yet`}</div>
      )}
    </MenuSurface>
  )
}
