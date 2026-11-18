/**
 * What the composer's model control lists on a CLI session: every provider the catalog
 * offers, so the session can move to another CLI or back to the harness from the same list.
 * The current CLI comes first and keeps its vendor headings; every other provider follows
 * as one section.
 * A session the harness runs keeps its native model seat instead (see model-menu.tsx),
 * because that seat also carries settings such as the agent-team toggle. The
 * harness-provider branch below still derives the current selection for callers such as
 * the mode seat.
 * @module dsh-ccgui/client/menu-models
 */

import { CLI_ROUTE_PREFIX } from '../constants.ts'
import { cliModels } from './choices.ts'
import type { DirectoryGroup, DirectoryReasoning, DirectorySelection, DirectoryState } from './choices.ts'

const ACCOUNT_PROVIDER_ID = 'deepseek-account'
const OFFICIAL_PROVIDER_ID = 'deepseek-official'
/** The harness renames this group in its own menu; this one follows. */
const ACCOUNT_PROVIDER_NAME = 'DeepSeek Account'
const MENU_LABEL = 'Models'
/** The harness's own label for letting the provider pick the level, untranslated there too. */
const PROVIDER_DEFAULT_LABEL = 'Default'
const PROVIDER_DEFAULT_KEY = 'provider-default'
const LOADING_STATUS = 'loading'
/** Splits a CLI model id such as `deepseek/deepseek-flash` into its vendor and the rest. */
const VENDOR_SEPARATOR = '/'
/** Joins a provider and a vendor in one section heading. */
const SECTION_SEPARATOR = ' · '
/** Fewer vendors than this leave a CLI's list whole; splitting would add a heading per vendor. */
const MIN_VENDOR_SECTIONS = 2

/** One model row, which only the provider and the model id together identify. */
export interface MenuRow {
  readonly provider: string
  readonly model: string
  readonly name: string
  /** Compact label shown beside the name, e.g. a CLI's usage cost multiplier; prose is left out. */
  readonly description?: string
  readonly reasoning?: DirectoryReasoning
}

/** One provider's rows, or one vendor's within a CLI. */
export interface MenuSection {
  readonly id: string
  readonly name: string
  readonly rows: readonly MenuRow[]
}

/** One reasoning level; `effort` is undefined for the provider's own choice. */
export interface EffortLevel {
  readonly key: string
  readonly effort: string | undefined
  readonly name: string
}

/** Everything the model control renders. */
export interface MenuModels {
  /** Names the open card for assistive technology. */
  readonly label: string
  readonly sections: readonly MenuSection[]
  readonly current: MenuRow | undefined
  /** The catalog has not arrived yet, so a missing current model is not yet a missing one. */
  readonly loading: boolean
  /** Names the CLI whose list is still the stand-in it has before reporting its models. */
  readonly unlisted: string | undefined
  /** The current model's levels; empty when it advertises none. */
  readonly efforts: readonly EffortLevel[]
  readonly effort: EffortLevel | undefined
}

/**
 * Tell whether a row is the given selection.
 * @param row - a row.
 * @param selection - a selection, if any.
 * @returns true when both name the same provider and model.
 */
export function isRow(
  row: MenuRow,
  selection: Pick<DirectorySelection, 'provider' | 'model'> | null | undefined,
): boolean {
  return row.provider === selection?.provider && row.model === selection.model
}

/**
 * Count the rows, which decides whether the card offers search.
 * @param sections - the sections to count.
 * @returns the number of rows across them.
 */
export function rowCount(sections: readonly MenuSection[]): number {
  return sections.reduce((count, section) => count + section.rows.length, 0)
}

function toSection({ id, name, models }: DirectoryGroup): MenuSection {
  return {
    id,
    name: id === ACCOUNT_PROVIDER_ID ? ACCOUNT_PROVIDER_NAME : name,
    rows: models.map(({ id: model, name: modelName, description, reasoning }) => ({
      provider: id,
      model,
      name: modelName,
      ...(description === undefined ? {} : { description }),
      ...(reasoning === undefined ? {} : { reasoning }),
    })),
  }
}

/** The same order as the harness's menu: the account first, the API key second, the rest as listed. */
const providerRank = (id: string): number => (id === ACCOUNT_PROVIDER_ID ? 0 : id === OFFICIAL_PROVIDER_ID ? 1 : 2)

function effortLevels(reasoning: DirectoryReasoning | undefined): readonly EffortLevel[] {
  if (reasoning === undefined) return []
  const levels = reasoning.efforts.map(({ id, name }) => ({ key: `effort:${id}`, effort: id, name }))
  if (reasoning.defaultEffort !== undefined) return levels
  return [{ key: PROVIDER_DEFAULT_KEY, effort: undefined, name: PROVIDER_DEFAULT_LABEL }, ...levels]
}

function vendorOf(row: MenuRow): string | undefined {
  const at = row.model.indexOf(VENDOR_SEPARATOR)
  return at > 0 ? row.model.slice(0, at) : undefined
}

/**
 * ACP has no field saying which vendor a CLI model comes from, and OMP, PI and OpenCode list
 * several vendors in one flat list. Their ids carry it as a `vendor/` prefix, so a list with
 * more than one prefix is shown under one heading per vendor, the way those CLIs show it.
 * Rows without a prefix, the default entry among them, stay on top under the provider
 * heading; vendor headings carry the provider too, so a sticky heading still says which CLI.
 */
function vendorSections(section: MenuSection): readonly MenuSection[] {
  const vendors = [...new Set(section.rows.flatMap((row) => vendorOf(row) ?? []))]
  if (vendors.length < MIN_VENDOR_SECTIONS) return [section]
  const loose = section.rows.filter((row) => vendorOf(row) === undefined)
  const lead = loose.length === 0 ? [] : [{ ...section, rows: loose }]
  return [
    ...lead,
    ...vendors.map((vendor) => ({
      id: `${section.id}${VENDOR_SEPARATOR}${vendor}`,
      name: `${section.name}${SECTION_SEPARATOR}${vendor}`,
      rows: section.rows.filter((row) => vendorOf(row) === vendor),
    })),
  ]
}

type Listing = Pick<MenuModels, 'label' | 'sections' | 'unlisted'>

function listing(state: DirectoryState): Listing {
  const cli = cliModels(state)
  // A session on a CLI can move to any provider the catalog lists, so its menu offers every
  // group; that is what makes switching CLIs and moving back to the harness one control.
  const onCli = state.current?.provider.startsWith(CLI_ROUTE_PREFIX) ?? false
  // The current CLI comes first; its group heading and the vendor headings keep the
  // provider visible while the list scrolls. Every other provider follows as one group,
  // so another CLI or the harness is one pick away.
  const active = onCli ? state.groups.find((group) => group.id === cli?.provider) : undefined
  const rest = state.groups
    .filter((group) => (onCli ? group.id !== active?.id : !group.id.startsWith(CLI_ROUTE_PREFIX)))
    .sort((left, right) => providerRank(left.id) - providerRank(right.id))
    .map((group) => toSection(group))
  const sections = active === undefined ? rest : [...vendorSections(toSection(active)), ...rest]
  return { label: MENU_LABEL, sections, unlisted: cli?.listed === false ? cli.name : undefined }
}

/**
 * List what the model control offers a session.
 * @param state - the session's model directory.
 * @returns the sections, the current model and its reasoning levels.
 */
export function menuModels(state: DirectoryState): MenuModels {
  const listed = listing(state)
  const current = listed.sections.flatMap((section) => section.rows).find((row) => isRow(row, state.current))
  const efforts = effortLevels(current?.reasoning)
  const chosen = state.current?.reasoningEffort ?? current?.reasoning?.defaultEffort
  return {
    ...listed,
    current,
    loading: state.status === LOADING_STATUS,
    efforts,
    effort: efforts.find((level) => level.effort === chosen),
  }
}
