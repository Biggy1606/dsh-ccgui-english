/// <reference lib="dom" />

/**
 * The 新建 Worktree dialog: reads the repository behind the right-clicked workspace, lets the
 * user fill in the form, creates the worktree, and hands the result to its owner, which adds
 * the workspace and opens a session. Until the repository is read, or when there is none, it
 * shows a one-line status in place of the form.
 * @module dsh-ccgui/client/worktree/worktree-dialog
 */

import { useEffect, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RepoInfo, WorktreeApi } from './worktree-api.ts'
import { WorktreeFields } from './worktree-fields.tsx'
import { formProblem, initialForm, requestOf, workspaceTitle } from './worktree-form.ts'
import type { WorktreeForm } from './worktree-form.ts'
import { WT } from './worktree-styles.ts'

/** A worktree on disk, for the owner to add as a workspace. */
export interface CreatedWorktree {
  readonly path: string
  readonly branch: string
  readonly title: string
  readonly openSession: boolean
}

export interface WorktreeDialogProps {
  readonly api: WorktreeApi
  /** Rejects with a message ready to show when the workspace could not be added. */
  readonly onCreated: (created: CreatedWorktree) => Promise<void>
  readonly onClose: () => void
}

type InfoState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly info: RepoInfo }
  | { readonly phase: 'failed'; readonly message: string }

const TITLE = 'New Worktree'
const CLOSE = 'Close'
const CANCEL = 'Cancel'
const CREATE = 'Create Worktree'
const CREATING = 'Creating…'
const LOADING = 'Loading repository information…'
const NOT_A_REPO = 'This workspace is not in a Git repository; a worktree cannot be created.'
const NOT_READY = 'Repository information is not available yet'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function useRepoInfo(api: WorktreeApi): InfoState {
  const [state, setState] = useState<InfoState>({ phase: 'loading' })
  useEffect(() => {
    let live = true
    api.info().then(
      (answer) => {
        if (live) setState(answer.repo ? { phase: 'ready', info: answer } : { phase: 'failed', message: NOT_A_REPO })
      },
      (error: unknown) => {
        if (live) setState({ phase: 'failed', message: messageOf(error) })
      },
    )
    return () => {
      live = false
    }
  }, [api])
  return state
}

function useCreate(props: WorktreeDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const create = async (form: WorktreeForm, info: RepoInfo): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const created = await props.api.create(requestOf(form, info))
      if (!('path' in created)) throw new Error(NOT_A_REPO)
      const title = workspaceTitle(info, created.branch)
      await props.onCreated({ ...created, title, openSession: form.openSession })
      props.onClose()
    } catch (reason: unknown) {
      setError(messageOf(reason))
      setBusy(false)
    }
  }
  return { busy, error, create }
}

function Footer(props: {
  readonly busy: boolean
  readonly problem: string | undefined
  readonly onCancel: () => void
  readonly onCreate: () => void
}) {
  return (
    <div className={WT.footer}>
      <Button variant="ghost" disabled={props.busy} onClick={props.onCancel}>
        {CANCEL}
      </Button>
      <Button
        variant="primary"
        disabled={props.problem !== undefined || props.busy}
        title={props.problem}
        onClick={props.onCreate}
      >
        {props.busy ? CREATING : CREATE}
      </Button>
    </div>
  )
}

function StatusLine({ state }: { readonly state: Exclude<InfoState, { phase: 'ready' }> }) {
  return (
    <p className={WT.status} role={state.phase === 'failed' ? 'alert' : 'status'}>
      {state.phase === 'loading' ? LOADING : state.message}
    </p>
  )
}

/** Enter in a field creates, unless the branch list took it to pick a branch. */
function onEnter(submit: () => void) {
  return (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.nativeEvent.isComposing) return
    if (!(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    submit()
  }
}

/**
 * One modal from the first frame to the last: the status line gives way to the form inside
 * it, so the host's dialog does not close and reopen when the repository has been read.
 * @param props - the requests, and what to do once the worktree exists or the dialog closes.
 * @returns the dialog.
 */
export function WorktreeDialog(props: WorktreeDialogProps): ReactElement {
  const state = useRepoInfo(props.api)
  const info = state.phase === 'ready' ? state.info : undefined
  const [edited, setForm] = useState<WorktreeForm | undefined>()
  const form = edited ?? (info === undefined ? undefined : initialForm(info))
  const { busy, error, create } = useCreate(props)
  const problem = info === undefined || form === undefined ? NOT_READY : formProblem(form, info)
  const submit = (): void => {
    if (info !== undefined && form !== undefined && problem === undefined && !busy) void create(form, info)
  }
  return (
    <Modal
      open
      title={TITLE}
      {...(info === undefined ? {} : { description: `Based on repository ${info.name}` })}
      closeLabel={CLOSE}
      className={WT.dialog}
      onClose={busy ? () => undefined : props.onClose}
      footer={<Footer busy={busy} problem={problem} onCancel={props.onClose} onCreate={submit} />}
    >
      {state.phase !== 'ready' || form === undefined ? (
        state.phase !== 'ready' && <StatusLine state={state} />
      ) : (
        <div onKeyDown={onEnter(submit)}>
          <WorktreeFields form={form} info={state.info} disabled={busy} onChange={setForm} />
          {error === undefined ? null : (
            <p role="alert" className={WT.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
