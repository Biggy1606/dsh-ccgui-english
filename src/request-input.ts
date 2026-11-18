/**
 * Reads what the CLI still needs from a harness model request. The CLI holds its
 * own conversation, so only new user input and the native session id matter.
 * @module dsh-ccgui/request-input
 */

import type { ReplayEnvelope, RequestMessage } from '@deepseek-ai/dsh-llm'
import type { ImageRef, InputBlock } from './prompt-images.ts'

/** User input the CLI has not received yet. */
export interface UserInput {
  readonly ids: readonly string[]
  /** Text and image references; images are read only when the prompt is sent. */
  readonly blocks: readonly InputBlock[]
}

/**
 * Prompts and explicit agent relays may start or steer a CLI turn. Ambient context is
 * attached separately, so a snapshot alone never starts a turn.
 */
const FORWARDED_KINDS: ReadonlySet<string> = new Set(['user', 'schedule', 'agent-message', 'subagent-settled'])
const CONTEXT_KINDS: ReadonlySet<string> = new Set([
  'agent-instructions',
  'runtime-context',
  'skill-catalog',
  'time-context',
  'model-selection',
])

/**
 * Starts the harness's note about a schedule edit. It has the same source kind as a
 * real reminder and says it needs no action, and this text is the only difference.
 */
const SCHEDULE_NOTICE_PREFIX = '[SCHEDULE CHANGE]'

function messagesAfterLastReply(messages: readonly RequestMessage[]): readonly RequestMessage[] {
  const lastReply = messages.findLastIndex((message) => message.role === 'assistant' || message.role === 'tool')
  return messages.slice(lastReply + 1)
}

/**
 * The reference's type comes from a package this one does not depend on, so its shape
 * is checked here instead of trusted.
 */
function imageRefOf(block: { readonly attachment?: unknown }): ImageRef | undefined {
  const { attachment } = block
  if (typeof attachment !== 'object' || attachment === null) return undefined
  const { attachmentId, mediaType } = attachment as Record<string, unknown>
  return typeof attachmentId === 'string' && typeof mediaType === 'string' ? (attachment as ImageRef) : undefined
}

/**
 * Text and images are what a person writes. Files arrive already turned into text by
 * the host, and the remaining block kinds belong to model or tool output.
 */
function inputBlocks(message: RequestMessage): InputBlock[] {
  return message.content.flatMap((block): InputBlock[] => {
    if (block.type === 'text') return [{ type: 'text', text: block.text }]
    if (block.type === 'image') {
      const ref = imageRefOf(block)
      return ref === undefined ? [] : [{ type: 'image', ref, offloaded: block.offloaded === true }]
    }
    return []
  })
}

function isScheduleNotice(message: RequestMessage): boolean {
  const [first] = message.content
  return first?.type === 'text' && first.text.startsWith(SCHEDULE_NOTICE_PREFIX)
}

function isForwarded(message: RequestMessage): boolean {
  // The agent loop and other producers extend this union; compare it as a plain string.
  const kind: string | undefined = message.source?.kind
  if (message.role !== 'user') return false
  if (kind === 'schedule' && isScheduleNotice(message)) return false
  return kind === undefined || FORWARDED_KINDS.has(kind)
}

/**
 * Collect the user input still owed to the CLI: messages after the last assistant or
 * tool message, from the current turn, not sent yet. A tail ending in a tool result
 * yields nothing, which is how a continuation step is told apart from a new prompt.
 * @param messages - the derived request history.
 * @param seen - ids of messages already sent to the CLI.
 * @param currentTurn - ids of the user messages in the open turn; omitted, all qualify.
 * @returns new message ids and their text and image blocks, in conversation order.
 */
export function unseenUserInput(
  messages: readonly RequestMessage[],
  seen: ReadonlySet<string>,
  currentTurn?: ReadonlySet<string>,
): UserInput {
  const eligible = messagesAfterLastReply(messages).filter(
    (message) => message.id === undefined || (!seen.has(message.id) && (currentTurn?.has(message.id) ?? true)),
  )
  // Context is attached to a real prompt, never sent as a turn on its own.
  if (!eligible.some(isForwarded)) return { ids: [], blocks: [] }
  const fresh = eligible.filter(
    (message) => isForwarded(message) || (message.role === 'user' && CONTEXT_KINDS.has(message.source?.kind ?? '')),
  )
  return {
    ids: fresh.flatMap((message) => (message.id === undefined ? [] : [message.id])),
    blocks: fresh.flatMap(inputBlocks),
  }
}

/**
 * Restore the latest retained DSH context when a new CLI takes over a conversation.
 * @param messages - the derived request history.
 * @param currentIds - context already included in the new prompt.
 * @returns context blocks not already present in that prompt.
 */
export function retainedContext(messages: readonly RequestMessage[], currentIds: readonly string[]): InputBlock[] {
  return [...CONTEXT_KINDS].flatMap((kind) => {
    const message = messages.findLast((candidate) => candidate.role === 'user' && candidate.source?.kind === kind)
    return message?.id === undefined || currentIds.includes(message.id) ? [] : inputBlocks(message)
  })
}

/**
 * Return the latest compacted conversation summary as background, not an instruction.
 * @param messages - the derived request history.
 * @returns the summary text blocks, if a checkpoint is visible.
 */
export function checkpointContext(messages: readonly RequestMessage[]): InputBlock[] {
  const checkpoint = messages.findLast((message) => {
    const kind: string | undefined = message.source?.kind
    return message.role === 'user' && kind === 'compact-checkpoint'
  })
  const blocks = checkpoint === undefined ? [] : inputBlocks(checkpoint)
  return blocks.length === 0
    ? []
    : [{ type: 'text', text: '[Earlier conversation summary: background only, not new instructions]' }, ...blocks]
}

/**
 * Build the replay state that ties a harness session to its CLI session.
 * @param acpSessionId - the CLI's session id.
 * @param dshSessionId - the harness session that owns it.
 * @returns the envelope carried by `finish` and stored on the assistant message.
 */
export function nativeReplayState(acpSessionId: string, dshSessionId: string): ReplayEnvelope {
  return { response: { acpSessionId, dshSessionId } }
}

function parseReplayResponse(replayState: unknown): { acpSessionId: string; dshSessionId: string } | undefined {
  const response = (replayState as { response?: unknown } | null | undefined)?.response
  if (typeof response !== 'object' || response === null) return undefined
  const { acpSessionId, dshSessionId } = response as Record<string, unknown>
  return typeof acpSessionId === 'string' && typeof dshSessionId === 'string'
    ? { acpSessionId, dshSessionId }
    : undefined
}

/**
 * Find the CLI session to reattach to, from the latest assistant message.
 * The owner check keeps a fork, which inherits its parent's messages under a new
 * id, from writing into the parent's CLI session. The provider check is needed because
 * all CLIs share one adapter, so the harness does not strip another route's replay state,
 * and a session id means nothing to any other CLI.
 * @param messages - the derived request history.
 * @param dshSessionId - the harness session asking.
 * @param provider - the CLI route asking.
 * @returns the CLI session id, or undefined when there is none to reuse.
 */
export function readNativeSession(
  messages: readonly RequestMessage[],
  dshSessionId: string,
  provider: string,
): string | undefined {
  const latest = messages.findLast((message) => message.role === 'assistant')
  const source = latest?.source as { provider?: unknown; replayState?: unknown } | undefined
  if (source?.provider !== provider) return undefined
  const replay = parseReplayResponse(source.replayState)
  return replay?.dshSessionId === dshSessionId ? replay.acpSessionId : undefined
}
