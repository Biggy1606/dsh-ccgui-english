import { describe, expect, it } from 'vitest'
import {
  CHEVRON_CLASS,
  LABEL_CLASS,
  MODE_CLASS,
  MODE_SEAT_CLASS,
  MODEL_MENU_STYLES,
  TRIGGER_CLASS,
} from '../src/client/model-menu-styles.ts'

const RENDERED = [TRIGGER_CLASS, LABEL_CLASS, CHEVRON_CLASS, MODE_CLASS, MODE_SEAT_CLASS]

describe('MODEL_MENU_STYLES', () => {
  // The harness's picker stays the only model control on every session, so nothing may hide
  // its seat: the CLI's own controls sit beside it.
  it('leaves the harness picker in place', () => {
    expect(MODEL_MENU_STYLES).not.toContain('conversation.input.model] { display: none')
    expect(MODEL_MENU_STYLES).not.toContain(':has(.dsh-cli-model)')
  })

  it('styles every class the composer renders', () => {
    for (const name of RENDERED) expect(MODEL_MENU_STYLES).toContain(`.${name}`)
  })

  // The composer switches the mode control off as its row runs out of width.
  it("follows the composer's compact display", () => {
    expect(MODEL_MENU_STYLES).toContain('var(--dsh-composer-model-text-display, block)')
  })

  // The CLI's mode replaces the harness's access control only while the mode control shows.
  it('hides the access control only beside the CLI mode', () => {
    expect(MODEL_MENU_STYLES).toContain(
      `[data-composer-card]:has(.${MODE_CLASS}) [data-slot="conversation.input.permission"]`,
    )
  })
})
