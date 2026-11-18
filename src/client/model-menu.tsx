/// <reference lib="dom" />

/**
 * The composer's model control on a CLI session, in place of the harness's seat. It lists
 * every provider the catalog offers (see menu-models.ts), so the session can move to
 * another CLI or back to the harness from the same menu, and it keeps the reasoning level
 * beside it (see effort-menu.tsx). A session the harness itself runs keeps its native seat,
 * which also carries settings such as the agent-team toggle. The CLI's own modes are not
 * here: they take the permission seat instead (see mode-seat.tsx).
 * @module dsh-ccgui/client/model-menu
 */

import type { CSSProperties, ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChevronDownOutlineRegular,
  IconDataOutlineRegular,
  IconWarningOutlineRegular,
  StateDot,
  Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { isCliRoute } from '../constants.ts'
import type { DirectorySelection, DirectoryState } from './choices.ts'
import { EffortMenu } from './effort-menu.tsx'
import { arrangeFavoriteSections, createFavoriteModels } from './favorite-models.ts'
import type { FavoriteModels } from './favorite-models.ts'
import { menuModels } from './menu-models.ts'
import type { MenuModels, MenuRow } from './menu-models.ts'
import { ModelCard } from './model-card.tsx'
import { CHEVRON_CLASS, GROUP_CLASS, ICON_CLASS, LABEL_CLASS, ROOT_CLASS, TRIGGER_CLASS } from './model-menu-styles.ts'
import { useModelSeat } from './model-seat.ts'
import type { ModelSeatProps, SelectModel } from './model-seat.ts'
import type { SessionFacts } from './session-facts.ts'
import { useRemoved } from './session-facts.ts'
import { useStore } from './store.ts'
import type { Store } from './store.ts'

const NO_MODEL_LABEL = 'Select a model'
const LOADING_LABEL = 'Loading models…'
const EMPTY_FAVORITES = createFavoriteModels({ getItem: () => null, setItem: () => undefined })

/** What the slot hands this control for one session. */
export interface ModelMenuInjected {
  /** False for an addressed subagent, which cannot select a model. */
  available: boolean
  directory: Store<DirectoryState>
  load: () => void
  select: SelectModel
  session: SessionFacts | undefined
  favorites?: FavoriteModels
}

type Seat = ReturnType<typeof useModelSeat>

interface ModelTriggerProps {
  readonly seat: Seat
  readonly models: MenuModels
  readonly pending: DirectorySelection | null
  readonly locked: boolean
  readonly label: string
  readonly anchorStyle: CSSProperties
}

function ModelTrigger({ seat, models, pending, locked, label, anchorStyle }: ModelTriggerProps): ReactElement {
  const { id, showing } = seat
  return (
    <button
      ref={seat.triggerRef}
      type="button"
      className={TRIGGER_CLASS}
      style={anchorStyle}
      aria-label={models.current === undefined ? label : `Select model, current: ${label}`}
      aria-haspopup="menu"
      aria-expanded={showing}
      aria-controls={showing ? `${id}-menu` : undefined}
      aria-busy={pending !== null}
      title={label}
      data-selection-focus={seat.settled ? '' : undefined}
      disabled={locked}
      onBlur={() => {
        seat.setSettled(false)
      }}
      onClick={seat.toggle}
    >
      <IconDataOutlineRegular className={ICON_CLASS} size={16} />
      <span className={LABEL_CLASS}>{label}</span>
      {pending === null ? (
        <IconChevronDownOutlineRegular className={CHEVRON_CLASS} size={14} />
      ) : (
        <StateDot state="ongoing" />
      )}
    </button>
  )
}

interface FavoriteSeatProps {
  readonly isFavorite?: (row: MenuRow) => boolean | undefined
  readonly onToggleFavorite?: (row: MenuRow) => void
}

function queryHandler(seat: Seat): (next: string) => void {
  return (next) => {
    seat.setQuery(next)
    seat.setHighlight(0)
  }
}

function ModelSeat(props: ModelSeatProps & FavoriteSeatProps): ReactElement {
  const { models, pending, locked, isFavorite, isUnavailable, onToggleFavorite } = props
  const seat = useModelSeat(props)
  const { id, showing, rootRef } = seat
  const anchorStyle = { '--dsh-cli-model-anchor': `--dsh-cli-model-${id.replaceAll(':', '')}` } as CSSProperties
  const label = models.current?.name ?? (models.loading ? LOADING_LABEL : NO_MODEL_LABEL)
  return (
    <div ref={rootRef} className={ROOT_CLASS} onKeyDown={seat.onKeyDown} onBlur={seat.onBlur}>
      <ModelTrigger
        seat={seat}
        models={models}
        pending={pending}
        locked={locked}
        label={label}
        anchorStyle={anchorStyle}
      />
      {showing &&
        createPortal(
          <ModelCard
            id={id}
            models={models}
            sections={seat.sections}
            active={seat.active}
            pending={pending}
            query={seat.query}
            anchorStyle={anchorStyle}
            cardRef={seat.cardRef}
            searchRef={seat.searchRef}
            onQuery={queryHandler(seat)}
            onHighlight={seat.setHighlight}
            onChoose={seat.choose}
            isFavorite={isFavorite}
            isUnavailable={isUnavailable}
            onToggleFavorite={onToggleFavorite}
          />,
          document.body,
        )}
      {seat.failure !== undefined && (
        <Toast
          key={seat.failure.seq}
          text={`Failed to change model: ${seat.failure.text}`}
          icon={<IconWarningOutlineRegular />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={seat.clearFailure}
        />
      )}
    </div>
  )
}

/**
 * Render the control on a CLI session, or nothing elsewhere: an addressed subagent cannot
 * select a model, and a harness session keeps its own seat with its own settings.
 * @param props - what the slot injected.
 * @returns the trigger and the level beside it, and while open the list.
 */
export function CliModelMenu({
  available,
  directory,
  load,
  select,
  session,
  favorites,
}: ModelMenuInjected): ReactElement | null {
  const state = useStore(directory)
  const saved = useStore(favorites ?? EMPTY_FAVORITES)
  const locked = useRemoved(session)
  const listed = menuModels(state)
  const sections = arrangeFavoriteSections(listed.sections, saved, (provider) => {
    if (state.status !== 'ready') return false
    const group = state.groups.find((candidate) => candidate.id === provider)
    return !isCliRoute(provider) || group === undefined || group.models.some((model) => model.name !== group.name)
  })
  const models = { ...listed, sections }
  const findRow = (row: MenuRow) =>
    sections
      .flatMap((section) => section.rows)
      .find((candidate) => candidate.provider === row.provider && candidate.model === row.model)
  const isUnavailable = (row: MenuRow): boolean => findRow(row)?.unavailable ?? false
  const isFavorite = (row: MenuRow): boolean | undefined =>
    favorites === undefined ? undefined : (findRow(row)?.favorite ?? false)
  const onToggleFavorite = (row: MenuRow): void => {
    const section = sections.find((candidate) =>
      candidate.rows.some((candidateRow) => candidateRow.provider === row.provider && candidateRow.model === row.model),
    )
    if (section !== undefined) favorites?.setFavorite(section, row, !isFavorite(row))
  }
  // The harness's seat carries more than the model list, so replacing it would take those
  // settings away from a session the harness runs. Only a CLI needs a menu of its own models.
  // Judge by the selection rather than the resolved row: a CLI's catalog can arrive late.
  if (!available || !isCliRoute(state.current?.provider)) return null
  const pending = state.pending ?? null
  return (
    <div className={GROUP_CLASS}>
      <ModelSeat
        models={models}
        pending={pending}
        locked={locked}
        load={load}
        select={select}
        isFavorite={isFavorite}
        isUnavailable={isUnavailable}
        onToggleFavorite={onToggleFavorite}
      />
      <EffortMenu models={models} pending={pending} locked={locked} select={select} />
    </div>
  )
}
