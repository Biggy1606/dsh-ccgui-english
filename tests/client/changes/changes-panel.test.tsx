// @vitest-environment jsdom
/// <reference lib="dom" />

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangesPanel } from '../../../src/client/changes/changes-panel.tsx'
import type { CwdList } from '../../../src/client/changes/changes-panel.tsx'
import type { Fetch } from '../../../src/client/changes/changes-api.ts'
import type { RepoStatus } from '../../../src/client/changes/changes-model.ts'

type Handler = (body: Record<string, unknown>) => unknown

const STATUS: RepoStatus = {
  repo: true,
  root: '/work',
  branch: 'main',
  ahead: 1,
  behind: 0,
  staged: [{ path: 'src/app/page.tsx', status: 'M', additions: 3, deletions: 10 }],
  unstaged: [{ path: 'src/lib/courses.ts', status: 'M', additions: 11, deletions: 22 }],
  untracked: [{ path: 'notes.md', status: '?', additions: 4 }],
}

/** A fake of the git routes: each operation answers from `handlers`, everything else with STATUS. */
function server(handlers: Record<string, Handler> = {}) {
  const calls: { operation: string; body: Record<string, unknown> }[] = []
  const fetchFn = vi.fn<Fetch>((url, init) => {
    const operation = url.split('/').pop() ?? ''
    const body = JSON.parse(typeof init.body === 'string' ? init.body : '') as Record<string, unknown>
    calls.push({ operation, body })
    try {
      const data = (handlers[operation] ?? (() => STATUS))(body)
      return Promise.resolve(new Response(JSON.stringify({ success: true, data }), { status: 200 }))
    } catch (error: unknown) {
      return Promise.resolve(
        new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 409 }),
      )
    }
  })
  return { fetchFn, calls, ops: () => calls.map((call) => call.operation) }
}

function list(cwd: string): CwdList {
  return { subscribe: () => () => undefined, getSnapshot: () => ({ byId: { s1: { cwd } } }) }
}

function renderPanel(fetchFn: Fetch, cwd = '/work') {
  return render(<ChangesPanel sessionId="s1" list={list(cwd)} fetch={fetchFn} />)
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ChangesPanel', () => {
  it('shows the header, summary and groups like CC GUI, with staged files selected', async () => {
    const { fetchFn } = server()
    renderPanel(fetchFn)
    expect(await screen.findByText('3 uncommitted changes')).toBeTruthy()
    expect(screen.getByText('↑1 ↓0')).toBeTruthy()
    expect(screen.getByText('+18')).toBeTruthy()
    expect(screen.getByText('−32')).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.getByLabelText('Branch').textContent).toContain('main')
    for (const title of ['Staged', 'Unstaged', 'Untracked']) {
      expect(screen.getByRole('region', { name: title })).toBeTruthy()
    }
    expect(screen.getByLabelText<HTMLInputElement>('Select src/app/page.tsx').checked).toBe(true)
    expect(screen.getByLabelText<HTMLInputElement>('Select notes.md').checked).toBe(false)
    expect(screen.getByRole('button', { name: 'Commit (1)' })).toHaveProperty('disabled', true)
  })

  it('commits the selected files with the message and clears the message', async () => {
    const { fetchFn, calls } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.click(await screen.findByLabelText('Select notes.md'))
    await user.type(screen.getByLabelText('Commit message'), 'feat: add notes')
    await user.click(screen.getByRole('button', { name: 'Commit (2)' }))
    await waitFor(() => {
      expect(calls.find((call) => call.operation === 'commit')?.body).toEqual({
        message: 'feat: add notes',
        paths: ['src/app/page.tsx', 'notes.md'],
        cwd: '/work',
      })
    })
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLTextAreaElement>('Commit message').value).toBe('')
    })
  })

  it('commits with Cmd+Enter', async () => {
    const { fetchFn, ops } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.type(await screen.findByLabelText('Commit message'), 'fix: x{Meta>}{Enter}{/Meta}')
    await waitFor(() => {
      expect(ops()).toContain('commit')
    })
  })

  it('keeps the AI commit-message button visible but says it is not available yet', async () => {
    const { fetchFn } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    const ai = await screen.findByRole('button', { name: 'Generate commit message with AI' })
    expect(screen.queryByText('Not available yet')).toBeNull()
    await user.click(ai)
    expect(await screen.findByText('Not available yet')).toBeTruthy()
  })

  it('selects a whole group from its checkbox and marks a partial group', async () => {
    const { fetchFn } = server({
      status: () => ({
        ...STATUS,
        untracked: [
          { path: 'a.md', status: '?' },
          { path: 'b.md', status: '?' },
        ],
      }),
    })
    const user = userEvent.setup()
    renderPanel(fetchFn)
    const group = await screen.findByRole('region', { name: 'Untracked' })
    await user.click(within(group).getByLabelText('Select a.md'))
    expect(within(group).getByLabelText<HTMLInputElement>('Select all in group').indeterminate).toBe(true)
    await user.click(within(group).getByLabelText('Select all in group'))
    expect(screen.getByText('3 selected')).toBeTruthy()
  })

  it('toggles a group from its header row without its controls toggling it', async () => {
    const { fetchFn } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    const staged = await screen.findByRole('region', { name: 'Staged' })
    const rowName = /page\.tsx/

    await user.click(within(staged).getByText('Staged'))
    expect(within(staged).queryByRole('button', { name: rowName })).toBeNull()
    expect(within(staged).getByRole('button', { name: 'Expand Staged' })).toBeTruthy()

    await user.click(within(staged).getByText('Staged'))
    expect(within(staged).getByRole('button', { name: rowName })).toBeTruthy()
    expect(within(staged).getByRole('button', { name: 'Collapse Staged' })).toBeTruthy()

    await user.click(within(staged).getByLabelText('Select all in group'))
    await user.click(within(staged).getByRole('button', { name: 'Unstage all' }))
    expect(within(staged).getByRole('button', { name: rowName })).toBeTruthy()
  })

  it('stages, unstages and stages a group from the row and group controls', async () => {
    const { fetchFn, calls } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    const unstaged = await screen.findByRole('region', { name: 'Unstaged' })
    await user.click(within(unstaged).getByRole('button', { name: 'Stage' }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'stage', body: { paths: ['src/lib/courses.ts'] } })
    })
    await user.click(screen.getByRole('button', { name: 'Unstage all' }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'unstage', body: { paths: ['src/app/page.tsx'] } })
    })
    const untracked = screen.getByRole('region', { name: 'Untracked' })
    await user.click(within(untracked).getByRole('button', { name: 'Stage all' }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'stage', body: { paths: ['notes.md'] } })
    })
  })

  it('asks before discarding, and deletes untracked files as untracked', async () => {
    const { fetchFn, calls, ops } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    const untracked = await screen.findByRole('region', { name: 'Untracked' })
    await user.click(within(untracked).getByRole('button', { name: 'Discard changes' }))
    const dialog = screen.getByRole('dialog', { name: 'Discard changes' })
    expect(dialog.textContent).toContain('Discard changes to “notes.md”?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(ops()).not.toContain('discard')

    const unstaged = screen.getByRole('region', { name: 'Unstaged' })
    await user.click(within(unstaged).getByRole('button', { name: 'Discard all' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({
        operation: 'discard',
        body: { tracked: ['src/lib/courses.ts'], untracked: [] },
      })
    })
    await user.click(
      within(screen.getByRole('region', { name: 'Untracked' })).getByRole('button', { name: 'Discard changes' }),
    )
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'discard', body: { tracked: [], untracked: ['notes.md'] } })
    })
  })

  it('opens a file’s diff in place and goes back to the list', async () => {
    const { fetchFn, calls } = server({
      diff: () => ({ patch: '@@ -1 +1 @@\n-old\n+new\n', truncated: false }),
    })
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.click(await screen.findByRole('button', { name: /courses\.ts/ }))
    expect(await screen.findByText('+new')).toBeTruthy()
    expect(screen.getByText('-old')).toBeTruthy()
    expect(screen.getByText('Unstaged')).toBeTruthy()
    expect(calls.at(-1)).toMatchObject({ operation: 'diff', body: { path: 'src/lib/courses.ts', side: 'unstaged' } })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('3 uncommitted changes')).toBeTruthy()
  })

  it('says when a diff is too large, empty, or failed', async () => {
    let answer: () => unknown = () => ({ patch: '', truncated: true })
    const { fetchFn } = server({ diff: () => answer() })
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.click(await screen.findByRole('button', { name: /page\.tsx/ }))
    expect(await screen.findByText('Diff is too large and has been truncated')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    answer = () => ({ patch: '', truncated: false })
    await user.click(await screen.findByRole('button', { name: /page\.tsx/ }))
    expect(await screen.findByText('No differences to display')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    answer = () => {
      throw new Error('读取差异失败：boom')
    }
    await user.click(await screen.findByRole('button', { name: /notes\.md/ }))
    expect(await screen.findByText('读取差异失败：boom')).toBeTruthy()
  })

  it('pulls, pushes and refreshes from the header', async () => {
    const { fetchFn, ops } = server()
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await screen.findByText('3 uncommitted changes')
    await user.click(screen.getByRole('button', { name: 'Pull' }))
    await waitFor(() => {
      expect(ops()).toContain('pull')
    })
    await user.click(screen.getByRole('button', { name: 'Push' }))
    await waitFor(() => {
      expect(ops()).toContain('push')
    })
    const before = ops().filter((op) => op === 'status').length
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(ops().filter((op) => op === 'status').length).toBe(before + 1)
    })
  })

  it('shows a refused operation in a dismissible banner', async () => {
    const { fetchFn } = server({
      push: () => {
        throw new Error('推送失败：没有名为 origin 的远程仓库')
      },
    })
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.click(await screen.findByRole('button', { name: 'Push' }))
    expect((await screen.findByRole('alert')).textContent).toContain('没有名为 origin 的远程仓库')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('switches to local and remote branches and creates a branch', async () => {
    const { fetchFn, calls } = server({
      branches: () => ({ current: 'main', local: ['main', 'dev'], remote: ['origin/feat'] }),
    })
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.click(await screen.findByLabelText('Branch'))
    await user.click(await screen.findByRole('menuitemradio', { name: 'dev' }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'checkout', body: { branch: 'dev', remote: false } })
    })
    await user.click(screen.getByLabelText('Branch'))
    await user.click(await screen.findByRole('menuitemradio', { name: /origin\/feat/ }))
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'checkout', body: { branch: 'origin/feat', remote: true } })
    })
    await user.click(screen.getByLabelText('Branch'))
    await user.click(await screen.findByRole('menuitemradio', { name: 'New branch…' }))
    await user.type(screen.getByLabelText('Branch name'), 'topic{Enter}')
    await waitFor(() => {
      expect(calls.at(-1)).toMatchObject({ operation: 'create-branch', body: { branch: 'topic' } })
    })
  })

  it('leaves the new-branch form with 返回 or Escape', async () => {
    const { fetchFn, ops } = server({ branches: () => ({ repo: false }) })
    const user = userEvent.setup()
    renderPanel(fetchFn)
    await user.click(await screen.findByLabelText('Branch'))
    await user.click(await screen.findByRole('menuitemradio', { name: 'New branch…' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByLabelText('Branch'))
    await user.click(await screen.findByRole('menuitemradio', { name: 'New branch…' }))
    await user.type(screen.getByLabelText('Branch name'), 'x{Escape}')
    expect(screen.getByLabelText('Branch')).toBeTruthy()
    expect(ops()).not.toContain('create-branch')
  })

  it('shows empty, not-a-repo, no-directory and load-failure states', async () => {
    const clean = server({ status: () => ({ ...STATUS, staged: [], unstaged: [], untracked: [] }) })
    renderPanel(clean.fetchFn)
    expect(await screen.findByText('No changes')).toBeTruthy()
    cleanup()
    renderPanel(server({ status: () => ({ repo: false }) }).fetchFn)
    expect(await screen.findByText('The current workspace is not a Git repository')).toBeTruthy()
    cleanup()
    renderPanel(server().fetchFn, '')
    expect(screen.getByText('This session has no working directory yet')).toBeTruthy()
    cleanup()
    const failing = server({
      status: () => {
        throw new Error('读取 Git 状态失败：boom')
      },
    })
    renderPanel(failing.fetchFn)
    expect(await screen.findByText('读取 Git 状态失败：boom')).toBeTruthy()
  })

  it('refreshes on window focus and on a timer, and stops when unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { fetchFn, ops } = server()
    const view = renderPanel(fetchFn)
    await screen.findByText('3 uncommitted changes')
    const count = () => ops().filter((op) => op === 'status').length
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => {
      expect(count()).toBe(2)
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await waitFor(() => {
      expect(count()).toBe(3)
    })
    view.unmount()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(count()).toBe(3)
  })

  it('skips the timer while the page is hidden and refreshes once it is visible again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const visibility = { state: 'visible' as DocumentVisibilityState }
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility.state })
    try {
      const { fetchFn, ops } = server()
      renderPanel(fetchFn)
      await screen.findByText('3 uncommitted changes')
      const count = () => ops().filter((op) => op === 'status').length
      visibility.state = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(45_000)
      expect(count()).toBe(1)
      visibility.state = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      await waitFor(() => {
        expect(count()).toBe(2)
      })
    } finally {
      // Drops the own property, so the prototype's getter answers again.
      Reflect.deleteProperty(document, 'visibilityState')
    }
  })
})
