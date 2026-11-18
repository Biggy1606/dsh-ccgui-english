// @vitest-environment jsdom
/// <reference lib="dom" />

/**
 * Component-level mirror of the model-menu scenarios in e2e/fake-cli.mjs, tested only through
 * the public `CliModelMenu` export so internal reorganisation does not break these tests.
 */

import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { menuModels } from '../../src/client/menu-models.ts'
import { ModelCard } from '../../src/client/model-card.tsx'
import { useModelSeat } from '../../src/client/model-seat.ts'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DirectorySelection, DirectoryState } from '../../src/client/choices.ts'
import { CliModelMenu } from '../../src/client/model-menu.tsx'
import type { ModelMenuInjected } from '../../src/client/model-menu.tsx'
import {
  MENU_CLASS,
  ROW_ACTIVE_CLASS,
  ROW_DESCRIPTION_CLASS,
  ROW_MARK_CLASS,
} from '../../src/client/model-menu-styles.ts'
import { createStore } from '../fixtures/client-store.ts'
import type { TestStore } from '../fixtures/client-store.ts'

const PROVIDER = 'cli-fake'
const FEW_MODELS = [
  { id: 'default', name: 'Fake Small（默认）' },
  { id: 'fake-small', name: 'Fake Small' },
  { id: 'fake-large', name: 'Fake Large' },
]
const MANY_MODELS = [
  ...FEW_MODELS,
  { id: 'fake-medium', name: 'Fake Medium' },
  { id: 'fake-huge', name: 'Fake Huge' },
  { id: 'other-turbo', name: 'Other Turbo' },
]

type SelectResult = Awaited<ReturnType<ModelMenuInjected['select']>>

function directoryState(
  models = FEW_MODELS,
  current = 'default',
  pending?: DirectorySelection,
  provider = PROVIDER,
): DirectoryState {
  return {
    groups: [{ id: provider, name: 'Fake CLI', models }],
    current: { provider, model: current },
    pending: pending ?? null,
  }
}

interface Setup {
  readonly directory: TestStore<DirectoryState>
  readonly session: TestStore<{ removed?: boolean }>
  readonly load: ReturnType<typeof vi.fn<() => void>>
  readonly select: ReturnType<typeof vi.fn<ModelMenuInjected['select']>>
  readonly user: ReturnType<typeof userEvent.setup>
}

function setup(state = directoryState(), result: () => Promise<SelectResult> = () => Promise.resolve({})): Setup {
  const directory = createStore(state)
  const session = createStore<{ removed?: boolean }>({})
  const load = vi.fn<() => void>()
  const select = vi.fn<ModelMenuInjected['select']>(result)
  render(
    <div data-composer-card>
      <CliModelMenu available directory={directory} load={load} select={select} session={session} />
    </div>,
  )
  return { directory, session, load, select, user: userEvent.setup() }
}

const trigger = () => screen.getByRole('button', { name: /^(Select model|Select a model)/ })
const rows = () => screen.queryAllByRole('menuitemradio')
const rowNames = () => rows().map((row) => row.getAttribute('title'))
const activeRow = () =>
  rows()
    .find((row) => row.classList.contains(ROW_ACTIVE_CLASS))
    ?.getAttribute('title')
const card = () => document.querySelector(`.${MENU_CLASS}`)

function expectClosed(): void {
  expect(trigger().getAttribute('aria-expanded')).toBe('false')
  expect(rows()).toHaveLength(0)
}

/** A promise the test settles by hand, to observe the menu while a selection is out. */
function deferred() {
  let resolve: (value: SelectResult) => void = () => undefined
  const promise = new Promise<SelectResult>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

beforeAll(() => {
  // jsdom does not lay out, so it has no scrollIntoView; the menu calls it to keep the highlight in view.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
})

function FavoriteTestMenu({
  select,
  removeRow = false,
}: {
  readonly select: ModelMenuInjected['select']
  readonly removeRow?: boolean
}) {
  const [favorite, setFavorite] = useState(true)
  const listed = removeRow ? MANY_MODELS.slice(0, 5).filter((row) => favorite || row.id !== 'fake-large') : MANY_MODELS
  const models = menuModels(directoryState(listed))
  const isUnavailable = (row: { model: string }) => row.model === 'fake-large'
  const seat = useModelSeat({ models, pending: null, locked: false, load: () => undefined, select, isUnavailable })
  return (
    <div ref={seat.rootRef} onKeyDown={seat.onKeyDown} onBlur={seat.onBlur}>
      <button ref={seat.triggerRef} aria-controls={seat.showing ? `${seat.id}-menu` : undefined} onClick={seat.toggle}>
        Open favorites
      </button>
      {seat.showing && (
        <ModelCard
          id={seat.id}
          models={models}
          sections={seat.sections}
          active={seat.active}
          pending={null}
          query={seat.query}
          anchorStyle={{}}
          cardRef={seat.cardRef}
          searchRef={seat.searchRef}
          onQuery={(query) => {
            seat.setQuery(query)
            seat.setHighlight(0)
          }}
          onHighlight={seat.setHighlight}
          onChoose={seat.choose}
          isUnavailable={isUnavailable}
          isFavorite={(row) => (row.model === 'fake-large' ? favorite : undefined)}
          onToggleFavorite={() => {
            setFavorite(!favorite)
          }}
        />
      )}
    </div>
  )
}

describe('favorite model controls', () => {
  it('returns focus to the trigger when removing a favorite also removes search', async () => {
    const select = vi.fn<ModelMenuInjected['select']>(() => Promise.resolve({}))
    const user = userEvent.setup()
    render(<FavoriteTestMenu select={select} removeRow />)
    const open = screen.getByRole('button', { name: 'Open favorites' })
    await user.click(open)
    expect(screen.getByRole('searchbox')).not.toBeNull()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(document.activeElement).toBe(open)
    expect(screen.getByRole('menu', { name: 'Models' })).not.toBeNull()
  })

  it('highlights the first new result when the query changes', async () => {
    const { user, select } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'huge' } })
    expect(rowNames()).toEqual(['Fake Huge'])
    fireEvent.change(search, { target: { value: 'fake' } })
    expect(activeRow()).toBe('Fake Small（默认）')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(select).toHaveBeenCalledWith({ provider: PROVIDER, model: 'fake-small' })
  })
  it('keeps a separate keyboard-operable star for an unavailable model without choosing or closing', async () => {
    const select = vi.fn<ModelMenuInjected['select']>(() => Promise.resolve({}))
    const user = userEvent.setup()
    render(<FavoriteTestMenu select={select} />)
    await user.click(screen.getByRole('button', { name: 'Open favorites' }))
    const unavailable = screen.getByRole('menuitemradio', { name: /Fake Large/ })
    expect(unavailable.hasAttribute('disabled')).toBe(true)
    expect(unavailable.textContent).toContain('Unavailable')
    await user.keyboard('large{Enter}')
    expect(select).not.toHaveBeenCalled()
    await user.tab()
    const star = screen.getByRole('button', { name: 'Remove Fake Large from favorites' })
    expect(document.activeElement).toBe(star)
    expect(unavailable.contains(star)).toBe(false)
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Add Fake Large to favorites' })).not.toBeNull()
    expect(screen.getByRole('menu', { name: 'Models' })).not.toBeNull()
    expect(select).not.toHaveBeenCalled()
  })
})

describe('CliModelMenu rendering', () => {
  it('renders nothing for an addressed subagent', () => {
    const directory = createStore(directoryState())
    const { container } = render(
      <CliModelMenu available={false} directory={directory} load={vi.fn()} select={vi.fn()} session={undefined} />,
    )
    expect(container.innerHTML).toBe('')
  })

  // The harness's own model seat carries settings such as the agent-team toggle, so a
  // session it runs keeps that seat instead of this control.
  it('renders nothing on a session the harness runs', () => {
    const state: DirectoryState = {
      groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: FEW_MODELS }],
      current: { provider: 'deepseek-official', model: 'fake-small' },
      pending: null,
    }
    const { container } = render(
      <CliModelMenu available directory={createStore(state)} load={vi.fn()} select={vi.fn()} session={undefined} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('names the current model on the trigger', () => {
    setup()
    expect(trigger().getAttribute('title')).toBe('Fake Small（默认）')
    expect(trigger().getAttribute('aria-label')).toBe('Select model, current: Fake Small（默认）')
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu')
  })

  it('asks for a model when the current one is not in the list', () => {
    setup(directoryState(FEW_MODELS, 'gone'))
    expect(trigger().getAttribute('aria-label')).toBe('Select a model')
    expect(trigger().textContent).toContain('Select a model')
  })

  it('shows the pending state on the trigger while a selection settles', () => {
    setup(directoryState(FEW_MODELS, 'default', { provider: PROVIDER, model: 'fake-large' }))
    expect(trigger().getAttribute('aria-busy')).toBe('true')
    expect(trigger().querySelector('[data-state-dot]')).not.toBeNull()
  })
})

describe('CliModelMenu opening and closing', () => {
  it("opens on the trigger with this CLI's models, and loads the catalog", async () => {
    const { user, load } = setup()
    await user.click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().getAttribute('aria-controls')).toBe(card()?.id)
    expect(rowNames()).toEqual(['Fake Small（默认）', 'Fake Small', 'Fake Large'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('lists the harness and the other CLIs too, and a pick moves the session there', async () => {
    const deepseek = {
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
    }
    const other = { id: 'cli-other', name: 'Other CLI', models: [{ id: 'other-model', name: 'Other Model' }] }
    const { user, select } = setup({
      groups: [{ id: PROVIDER, name: 'Fake CLI', models: FEW_MODELS }, deepseek, other],
      current: { provider: PROVIDER, model: 'default' },
      pending: null,
    })
    await user.click(trigger())
    expect(rowNames()).toEqual(['Fake Small（默认）', 'Fake Small', 'Fake Large', 'DeepSeek Chat', 'Other Model'])
    await user.click(screen.getByRole('menuitemradio', { name: 'DeepSeek Chat' }))
    expect(select).toHaveBeenCalledWith({ provider: 'deepseek-official', model: 'deepseek-chat' })
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'Other Model' }))
    expect(select).toHaveBeenLastCalledWith({ provider: 'cli-other', model: 'other-model' })
  })

  it('marks the current model as checked', async () => {
    const { user } = setup(directoryState(FEW_MODELS, 'fake-small'))
    await user.click(trigger())
    expect(rows().map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
  })

  // Names stay as the CLI gave them; the cost multiplier is small print on the right.
  it('shows a CLI cost multiplier beside a clean model name', async () => {
    const priced = [
      { id: 'default', name: 'Hy4（默认）' },
      { id: 'hy4free', name: 'Hy4', description: 'x0.00 credits' },
      { id: 'hy4std', name: 'Hy4', description: 'x0.29 credits' },
    ]
    const { user } = setup(directoryState(priced, 'hy4std'))
    await user.click(trigger())
    expect(rowNames()).toEqual(['Hy4（默认）', 'Hy4', 'Hy4'])
    expect(trigger().getAttribute('title')).toBe('Hy4')
    const small = rows().map((row) => row.querySelector(`.${ROW_DESCRIPTION_CLASS}`))
    expect(small.map((node) => node?.textContent ?? null)).toEqual([null, 'x0.00 credits', 'x0.29 credits'])
    expect(small[1]?.getAttribute('title')).toBe('x0.00 credits')
    // The small print joins the row's accessible name, so e2e picks rows by their title,
    // which stays the model name alone. Keep that selector usable.
    expect(document.querySelectorAll('[role="menuitemradio"][title="Hy4"]')).toHaveLength(2)
  })

  it('leaves no small print on a model without a description', async () => {
    const { user } = setup()
    await user.click(trigger())
    expect(document.querySelectorAll(`.${ROW_DESCRIPTION_CLASS}`)).toHaveLength(0)
  })

  // Providers also send sentences selling a model's strengths. Truncating one into a row
  // leaves an unreadable fragment beside the name, so the menu leaves prose out entirely.
  it.each([
    'Stronger agentic coding, knowledge work and long-horizon tasks',
    'Built for the most demanding agentic workflows',
    'Fastest for quick answers',
    '',
  ])('leaves a prose description off the row: %j', async (description) => {
    const described = [
      { id: 'flash', name: 'DeepSeek-V4.1-Flash' },
      { id: 'pro', name: 'DeepSeek-V4-Pro', description },
    ]
    const { user } = setup(directoryState(described, 'flash'))
    await user.click(trigger())
    expect(rowNames()).toEqual(['DeepSeek-V4.1-Flash', 'DeepSeek-V4-Pro'])
    expect(document.querySelectorAll(`.${ROW_DESCRIPTION_CLASS}`)).toHaveLength(0)
    if (description !== '') expect(screen.queryByText(description)).toBeNull()
  })

  it('closes when the trigger is pressed again, keeping focus on it', async () => {
    const { user } = setup()
    await user.click(trigger())
    await user.click(trigger())
    expectClosed()
    expect(document.activeElement).toBe(trigger())
  })

  it('closes on a press elsewhere', async () => {
    const { user } = setup()
    await user.click(trigger())
    await user.click(document.body)
    expectClosed()
  })

  it('stays open on a press inside the card', async () => {
    const { user } = setup()
    await user.click(trigger())
    const surface = card()
    expect(surface).not.toBeNull()
    if (surface instanceof HTMLElement) await user.click(surface)
    expect(rows()).toHaveLength(3)
  })

  it('keeps the search focused when a press hits non-focusable padding', async () => {
    const { user } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    const search = screen.getByRole('searchbox', { name: 'Search models…' })
    fireEvent.blur(search, { relatedTarget: null })
    expect(rows()).toHaveLength(MANY_MODELS.length)
    fireEvent.blur(search, { relatedTarget: document.body })
    expect(rows()).toHaveLength(0)
  })

  it('names the card and its list differently for assistive technology', async () => {
    const { user } = setup()
    await user.click(trigger())
    expect(screen.getByRole('group', { name: 'Model selection' })).not.toBeNull()
    expect(screen.getByRole('menu', { name: 'Models' })).not.toBeNull()
  })

  it('closes when focus leaves for something outside', async () => {
    const { user } = setup()
    const outside = document.createElement('button')
    document.body.append(outside)
    await user.click(trigger())
    outside.focus()
    await user.click(document.body)
    expectClosed()
    outside.remove()
  })
})

describe('CliModelMenu keyboard', () => {
  it('starts the highlight on the current model and moves it with the arrows, wrapping', async () => {
    const { user } = setup(directoryState(FEW_MODELS, 'fake-small'))
    await user.click(trigger())
    expect(activeRow()).toBe('Fake Small')
    await user.keyboard('{ArrowDown}')
    expect(activeRow()).toBe('Fake Large')
    await user.keyboard('{ArrowDown}')
    expect(activeRow()).toBe('Fake Small（默认）')
    await user.keyboard('{ArrowUp}')
    expect(activeRow()).toBe('Fake Large')
  })

  it('chooses the highlighted model with Enter and closes', async () => {
    const { user, select } = setup()
    await user.click(trigger())
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(select).toHaveBeenCalledWith({ provider: PROVIDER, model: 'fake-large' })
    expectClosed()
  })

  it('closes with Escape and with Shift+Tab', async () => {
    const { user } = setup()
    await user.click(trigger())
    await user.keyboard('{Escape}')
    expectClosed()
    await user.click(trigger())
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expectClosed()
  })

  it('ignores keys while closed', async () => {
    const { user, select } = setup()
    trigger().focus()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(select).not.toHaveBeenCalled()
  })

  it('ignores Enter while a selection is still settling', async () => {
    const { user, select } = setup(directoryState(FEW_MODELS, 'default', { provider: PROVIDER, model: 'fake-large' }))
    await user.click(trigger())
    await user.keyboard('{ArrowDown}{Enter}')
    expect(select).not.toHaveBeenCalled()
    expect(rows().every((row) => row.hasAttribute('disabled'))).toBe(true)
    expect(rows()[2]?.querySelector('[data-state-dot]')).not.toBeNull()
  })
})

describe('CliModelMenu search', () => {
  it("puts each model's maker beside it and a neutral mark where the maker is unknown", async () => {
    const models = [
      { id: 'deepseek-v4', name: 'DeepSeek V4' },
      { id: 'k3', name: 'K3' },
      { id: 'fake-small', name: 'Fake Small' },
    ]
    const { user } = setup(directoryState(models, 'k3'))
    await user.click(trigger())
    const marks = rows().map((row) => row.querySelector('[data-cli-mark]')?.getAttribute('data-cli-mark'))
    expect(marks).toEqual(['deepseek', 'kimi', 'unknown'])
    expect(rows().every((row) => row.querySelector(`.${ROW_MARK_CLASS}`) !== null)).toBe(true)
  })

  // The real CodeBuddy list mixes five vendors and one anonymous model. Its own purple
  // logo must not appear on any row: the logo names the CLI, not the model's maker.
  it('gives every model in an aggregator list its own maker', async () => {
    const models = [
      { id: 'hy4free', name: 'Hy4' },
      { id: 'glm-5.3', name: 'GLM-5.3' },
      { id: 'space-bunny', name: 'Space-Bunny' },
      { id: 'minimax-m3.1-flash', name: 'MiniMax-M3.1-Flash' },
      { id: 'step-5-preview', name: 'Step-5-Preview' },
      { id: 'mimo-v2.6-pro', name: 'Xiaomi MiMo-V2.6-Pro' },
    ]
    const { user } = setup(directoryState(models, 'hy4free', undefined, 'cli-codebuddy'))
    await user.click(trigger())
    const marks = rows().map((row) => row.querySelector('[data-cli-mark]')?.getAttribute('data-cli-mark'))
    expect(marks).toEqual(['hunyuan', 'zhipu', 'unknown', 'minimax', 'stepfun', 'xiaomi'])
    expect(marks).not.toContain('codebuddy')
  })

  it('offers no search for a short list', async () => {
    const { user } = setup()
    await user.click(trigger())
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('focuses the search for a long list and filters the rows as you type', async () => {
    const { user } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    const search = screen.getByRole('searchbox', { name: 'Search models…' })
    expect(document.activeElement).toBe(search)
    await user.keyboard('large')
    expect(rowNames()).toEqual(['Fake Large'])
    expect(search.getAttribute('aria-activedescendant')).toBe(rows()[0]?.id)
  })

  it('chooses the first match with Enter', async () => {
    const { user, select } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    await user.keyboard('turbo{Enter}')
    expect(select).toHaveBeenCalledWith({ provider: PROVIDER, model: 'other-turbo' })
  })

  it('says when nothing matches, and Enter then does nothing', async () => {
    const { user, select } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    await user.keyboard('zzz')
    expect(rows()).toHaveLength(0)
    expect(screen.getByRole('status').textContent).toBe('No matching models.')
    await user.keyboard('{Enter}')
    expect(select).not.toHaveBeenCalled()
  })

  it('leaves Tab alone when nothing matches, and hides the empty row list', async () => {
    const { user } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    const search = screen.getByRole('searchbox', { name: 'Search models…' })
    await user.keyboard('zzz')
    const list = document.getElementById(search.getAttribute('aria-controls') ?? '')
    expect(list?.hasAttribute('hidden')).toBe(true)
    expect(fireEvent.keyDown(search, { key: 'Tab' })).toBe(true)
  })

  it('clears the search when the menu closes', async () => {
    const { user } = setup(directoryState(MANY_MODELS))
    await user.click(trigger())
    await user.keyboard('large{Escape}')
    await user.click(trigger())
    expect(rows()).toHaveLength(MANY_MODELS.length)
  })
})

describe('CliModelMenu choosing with the mouse', () => {
  it('selects the clicked model with its provider', async () => {
    const { user, select } = setup()
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'Fake Large' }))
    expect(select).toHaveBeenCalledWith({ provider: PROVIDER, model: 'fake-large' })
    expectClosed()
  })

  it('just closes when the current model is clicked', async () => {
    const { user, select } = setup()
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'Fake Small（默认）' }))
    expect(select).not.toHaveBeenCalled()
    expectClosed()
  })

  it('moves the highlight with the pointer', async () => {
    const { user } = setup()
    await user.click(trigger())
    await user.hover(screen.getByRole('menuitemradio', { name: 'Fake Large' }))
    expect(activeRow()).toBe('Fake Large')
  })

  it('selects a model under a vendor heading with its full id', async () => {
    const vendored = [
      { id: 'default', name: 'Flash（默认）' },
      { id: 'deepseek/flash', name: 'DeepSeek Flash' },
      { id: 'kimi-code/k3', name: 'K3' },
    ]
    const { user, select } = setup(directoryState(vendored))
    await user.click(trigger())
    expect(
      Array.from(document.querySelectorAll('[data-menu-group-heading]')).map((heading) => heading.textContent),
    ).toEqual(['Fake CLI', 'Fake CLI · deepseek', 'Fake CLI · kimi-code'])
    expect(rowNames()).toEqual(['Flash（默认）', 'DeepSeek Flash', 'K3'])
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(select).toHaveBeenCalledWith({ provider: PROVIDER, model: 'kimi-code/k3' })
  })

  it('says when the CLI has not reported its models yet', async () => {
    const { user } = setup({
      groups: [{ id: PROVIDER, name: 'Fake CLI', models: [{ id: 'default', name: 'Fake CLI' }] }],
      current: { provider: PROVIDER, model: 'default' },
    })
    await user.click(trigger())
    expect(screen.getByRole('status').textContent).toBe('The model list for Fake CLI has not loaded yet')
  })
})

describe('CliModelMenu failed selection', () => {
  it.each([
    [
      'the error message',
      () => Promise.resolve({ error: { message: 'model busy' } }),
      'Failed to change model: model busy',
    ],
    [
      'the fallback for an error without a message',
      () => Promise.resolve({ error: {} }),
      'Failed to change model: Unknown error',
    ],
    [
      'a rejected selection',
      () => Promise.reject(new Error('socket closed')),
      'Failed to change model: Error: socket closed',
    ],
  ])('shows %s in a toast and keeps the menu open', async (_case, result: () => Promise<SelectResult>, text) => {
    const { user } = setup(directoryState(), result)
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'Fake Large' }))
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toContain(text)
    expect(toast.querySelector('[data-icon="warning"]')).not.toBeNull()
    expect(toast.getAttribute('data-anchored')).toBe('yes')
    expect(rows()).toHaveLength(3)
  })

  it('removes the toast once it is done', async () => {
    const { user } = setup(directoryState(), () => Promise.resolve({ error: { message: 'x' } }))
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'Fake Large' }))
    await user.click(within(await screen.findByRole('alert')).getByRole('button'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('CliModelMenu late answers and locking', () => {
  it('leaves a menu reopened since the selection alone when the answer arrives', async () => {
    const answer = deferred()
    const { user } = setup(directoryState(), () => answer.promise)
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'Fake Large' }))
    await user.keyboard('{Escape}')
    await user.click(trigger())
    answer.resolve({})
    await answer.promise
    expect(rows()).toHaveLength(3)
  })

  it('disables the trigger once the session is removed', () => {
    const { session } = setup()
    session.set({ removed: true })
    expect(trigger().hasAttribute('disabled')).toBe(true)
  })

  it('hides an open menu when the session is removed', async () => {
    const { user, session } = setup()
    await user.click(trigger())
    session.set({ removed: true })
    expect(rows()).toHaveLength(0)
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('follows directory updates, such as the harness settling a selection', () => {
    const { directory } = setup()
    directory.set(directoryState(FEW_MODELS, 'fake-large'))
    expect(trigger().getAttribute('title')).toBe('Fake Large')
  })

  it('hands focus to the native seat when the selection leaves the CLI', async () => {
    const state: DirectoryState = {
      groups: [
        { id: PROVIDER, name: 'Fake CLI', models: FEW_MODELS },
        { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'chat', name: 'DeepSeek Chat' }] },
      ],
      current: { provider: PROVIDER, model: 'default' },
    }
    const slot = document.createElement('div')
    slot.dataset.slot = 'conversation.input.model'
    const native = document.createElement('button')
    slot.append(native)
    document.body.append(slot)
    const holder: { directory?: Setup['directory'] } = {}
    const { user, directory } = setup(state, () => {
      holder.directory?.set({ ...state, current: { provider: 'deepseek-official', model: 'chat' } })
      return Promise.resolve({})
    })
    holder.directory = directory
    await user.click(trigger())
    await user.click(screen.getByRole('menuitemradio', { name: 'DeepSeek Chat' }))
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(native)
    })
    slot.remove()
  })
})
