import { isPlainObject } from './agent-memory-document-format'
import { isAgentMemoryType, type AgentMemoryType } from './agent-memory-types'

export const AGENT_MEMORY_NAME_MAX_LENGTH = 120
export const AGENT_MEMORY_DESCRIPTION_MAX_LENGTH = 500
export const AGENT_MEMORY_BODY_MAX_LENGTH = 20_000

/** A new Claude project memory file; `instruction` is reserved for CLAUDE.md / AGENTS.md sections. */
export type AgentMemoryNewMemoryDraft = {
  name: string
  description: string
  type: Exclude<AgentMemoryType, 'instruction'>
  body: string
}

export type AgentMemoryDraftValidation =
  | { ok: true; draft: AgentMemoryNewMemoryDraft }
  | { ok: false; reason: string }

export function validateAgentMemoryBody(body: string): string | null {
  return body.length > AGENT_MEMORY_BODY_MAX_LENGTH
    ? `body is limited to ${AGENT_MEMORY_BODY_MAX_LENGTH} characters`
    : null
}

/** Validates untrusted input (IPC, CLI) for a new memory. */
export function validateAgentMemoryNewDraft(input: unknown): AgentMemoryDraftValidation {
  if (!isPlainObject(input)) {
    return { ok: false, reason: 'memory must be an object' }
  }
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length === 0 || name.length > AGENT_MEMORY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: `name is required (max ${AGENT_MEMORY_NAME_MAX_LENGTH} characters)`
    }
  }
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > AGENT_MEMORY_DESCRIPTION_MAX_LENGTH || /[\r\n]/.test(description)) {
    return {
      ok: false,
      reason: `description must be one line (max ${AGENT_MEMORY_DESCRIPTION_MAX_LENGTH} characters)`
    }
  }
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const bodyProblem = validateAgentMemoryBody(body)
  if (bodyProblem) {
    return { ok: false, reason: bodyProblem }
  }
  const type = input.type
  if (!isAgentMemoryType(type) || type === 'instruction') {
    return { ok: false, reason: 'type must be user, feedback, project or reference' }
  }
  return { ok: true, draft: { name, description, type, body } }
}
