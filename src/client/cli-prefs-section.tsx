/**
 * The settings page's CLI 列表 tab: the order of the composer's CLI switcher and which providers
 * it shows.
 * @module dsh-ccgui/client/cli-prefs-section
 */

import type { ReactElement } from 'react'
import {
  Button,
  IconChevronDownOutlineRegular,
  IconChevronUpOutlineRegular,
  Switch,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { isBuiltInChoice, listedEntries } from './cli-prefs.ts'
import type { CliEntry, CliPrefs } from './cli-prefs.ts'
import { ProviderMark } from './marks.tsx'
import { useStore } from './store.ts'

const SECTION_INTRO = 'Choose the order and visibility of CLIs in the composer menu. Disabled CLIs are hidden.'
const EMPTY_HINT = 'Open a session to see the available CLIs here.'
const OFF_HINT = 'Disabled; hidden from the CLI menu'
const LOCKED_HINT = 'Built-in provider; always visible'
const SWITCH_ON_TITLE = 'Disable to hide from the CLI menu'
const SWITCH_OFF_TITLE = 'Enable to show in the CLI menu'
const MORE_CLIS_HINT = 'More CLIs coming soon…'
const MARK_SIZE = 16
const ARROW_SIZE = 14
const SECTION_CLASS = 'dsh-ccgui-cli-prefs'

export const CLI_PREFS_STYLES = `
.${SECTION_CLASS} { margin: 0; }
.${SECTION_CLASS}-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.${SECTION_CLASS}-row + .${SECTION_CLASS}-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.${SECTION_CLASS}-name { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; }
.${SECTION_CLASS}-off { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS}-locked { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS}-moves { display: flex; gap: 2px; }
.${SECTION_CLASS}-more { display: flex; align-items: center; gap: 10px; margin: 14px 0 0; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS}-more::before, .${SECTION_CLASS}-more::after { content: ''; flex: 1; border-top: 1px dashed var(--dsw-alias-border-l2); }
`

function MoveButtons({
  entry,
  first,
  last,
  prefs,
}: {
  readonly entry: CliEntry
  readonly first: boolean
  readonly last: boolean
  readonly prefs: CliPrefs
}) {
  return (
    <span className={`${SECTION_CLASS}-moves`}>
      <Button
        size="sm"
        aria-label={`Move ${entry.label} up`}
        disabled={first}
        icon={<IconChevronUpOutlineRegular size={ARROW_SIZE} />}
        onClick={() => {
          prefs.move(entry.id, -1)
        }}
      />
      <Button
        size="sm"
        aria-label={`Move ${entry.label} down`}
        disabled={last}
        icon={<IconChevronDownOutlineRegular size={ARROW_SIZE} />}
        onClick={() => {
          prefs.move(entry.id, 1)
        }}
      />
    </span>
  )
}

function CliRow({
  entry,
  first,
  last,
  prefs,
}: {
  readonly entry: CliEntry
  readonly first: boolean
  readonly last: boolean
  readonly prefs: CliPrefs
}) {
  const locked = isBuiltInChoice(entry.id)
  return (
    <li className={`${SECTION_CLASS}-row`} aria-label={entry.label}>
      <span className={`${SECTION_CLASS}-name`}>
        <ProviderMark provider={entry.id} size={MARK_SIZE} />
        <span>{entry.label}</span>
        {entry.enabled ? null : (
          <span className={`${SECTION_CLASS}-off`} role="status">
            {OFF_HINT}
          </span>
        )}
      </span>
      <MoveButtons entry={entry} first={first} last={last} prefs={prefs} />
      {locked ? (
        <span className={`${SECTION_CLASS}-locked`}>{LOCKED_HINT}</span>
      ) : (
        <Switch
          checked={entry.enabled}
          label={`Enable ${entry.label}`}
          title={entry.enabled ? SWITCH_ON_TITLE : SWITCH_OFF_TITLE}
          onChange={(next) => {
            prefs.setEnabled(entry.id, next)
          }}
        />
      )}
    </li>
  )
}

/**
 * @param props.prefs - the CLI preferences the list reads and writes.
 * @returns the section.
 */
export function CliPrefsSection({ prefs }: { readonly prefs: CliPrefs }): ReactElement {
  const entries = listedEntries(useStore(prefs))
  return (
    <section className={SECTION_CLASS}>
      <p className="dsh-ccgui-settings-intro">{entries.length === 0 ? EMPTY_HINT : SECTION_INTRO}</p>
      {entries.length === 0 ? null : (
        <ul className="dsh-ccgui-settings-list">
          {entries.map((entry, index) => (
            <CliRow
              key={entry.id}
              entry={entry}
              first={index === 0}
              last={index === entries.length - 1}
              prefs={prefs}
            />
          ))}
        </ul>
      )}
      <p className={`${SECTION_CLASS}-more`}>{MORE_CLIS_HINT}</p>
    </section>
  )
}
