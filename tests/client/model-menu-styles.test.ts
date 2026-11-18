// @vitest-environment jsdom
/// <reference lib="dom" />

/**
 * The native model seat and the plugin's menu read one global catalog and both list every
 * provider, so the plugin no longer hides CLI groups there: moving between a CLI and the
 * harness is a supported selection on either surface. The access control still steps aside
 * for a CLI's own mode control, keyed on a stable slot rather than a localized label.
 * @module dsh-ccgui/tests/client/model-menu-styles
 */

import { describe, expect, it } from 'vitest'
import { CLI_ROUTE_PREFIX } from '../../src/constants.ts'
import { MODE_CLASS, MODE_SEAT_CLASS, MODEL_MENU_STYLES, ROWS_CLASS } from '../../src/client/model-menu-styles.ts'

const HARNESS_MENU = `
<div id="harness" role="menu" aria-label="Model">
  <section data-menu-group id="harness-provider">
    <div data-menu-group-heading>DeepSeek Account</div>
    <button type="button" role="menuitemradio">
      <span data-provider-id="deepseek-account" data-model-id="v4-flash">DeepSeek-V4.1-Flash</span>
    </button>
  </section>
  <section data-menu-group id="cli-provider">
    <div data-menu-group-heading>Claude Code</div>
    <button type="button" role="menuitemradio">
      <span data-provider-id="${CLI_ROUTE_PREFIX}claude" data-model-id="default">Claude Code</span>
    </button>
  </section>
  <section data-menu-group id="harness-setting">
    <div data-menu-group-heading>Agent team</div>
    <button type="button" role="menuitemradio">Enable agent team</button>
  </section>
</div>
<div id="plugin" class="${ROWS_CLASS}" role="menu" aria-label="Models">
  <div role="none">
    <button type="button" role="menuitemradio">${CLI_ROUTE_PREFIX}codebuddy models</button>
  </div>
</div>
`

function installStyles(): void {
  document.head.innerHTML = `<style>${MODEL_MENU_STYLES}</style>`
  document.body.innerHTML = HARNESS_MENU
}

const displayOf = (id: string): string => {
  const node = document.getElementById(id)
  if (node === null) throw new Error(`missing ${id}`)
  return getComputedStyle(node).display
}

describe('the native model menu', () => {
  it('keeps a CLI group visible, so the session can move to it', () => {
    installStyles()
    expect(displayOf('cli-provider')).not.toBe('none')
  })

  it.each(['harness-provider', 'harness-setting'])('keeps %s visible', (id) => {
    installStyles()
    expect(displayOf(id)).not.toBe('none')
  })

  it("keeps the plugin's own menu visible", () => {
    installStyles()
    expect(displayOf('plugin')).not.toBe('none')
  })

  it('keeps a highlighted row clear of a sticky heading', () => {
    expect(MODEL_MENU_STYLES).toContain('scroll-margin-top: 24px')
  })
})

// The access control only steps aside for a mode control that is really there: a CLI that
// reports no modes leaves its seat empty, and the harness's control must stay usable. The
// slot attribute is locale-independent; an English session must behave like a Chinese one.
describe('the access control on a CLI session', () => {
  const composer = (seat: string): void => {
    document.head.innerHTML = `<style>${MODEL_MENU_STYLES}</style>`
    document.body.innerHTML = `
<div data-composer-card>
  <span class="${MODE_SEAT_CLASS}">${seat}</span>
  <button id="access" type="button" data-slot="conversation.input.permission" aria-label="Access mode: full access">Full access</button>
</div>`
  }

  it('stays when the CLI reports no modes', () => {
    composer('')
    expect(displayOf('access')).not.toBe('none')
  })

  it("steps aside for the CLI's mode control", () => {
    composer(`<span class="${MODE_CLASS}"><button type="button">Plan</button></span>`)
    expect(displayOf('access')).toBe('none')
  })
})
