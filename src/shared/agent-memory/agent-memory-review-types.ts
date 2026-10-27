import type {
  AgentMemoryAgent,
  AgentMemoryDecision,
  AgentMemoryItem,
  AgentMemoryScopeKind,
  AgentMemorySuggestionVerdict
} from './agent-memory-types'

/** Identifies a workspace by its repo's main checkout; global needs no path. */
export type AgentMemoryScopeRequest =
  | { kind: Extract<AgentMemoryScopeKind, 'global'> }
  | { kind: Extract<AgentMemoryScopeKind, 'workspace'>; repoPath: string }

export type AgentMemoryListing = {
  scope: AgentMemoryScopeRequest
  items: AgentMemoryItem[]
  unreviewedCount: number
  /** Agents with a link adapter; other sharing chips are shown as unavailable. */
  linkableAgents: AgentMemoryAgent[]
  /** Base ref the in-repo files and staleness checks were read from; null for global. */
  baseRef: string | null
  warnings: string[]
}

export const AGENT_MEMORY_FILE_CHANGE_KINDS = ['write', 'delete', 'move'] as const
export type AgentMemoryFileChangeKind = (typeof AGENT_MEMORY_FILE_CHANGE_KINDS)[number]

/** `orca`: Orca's rendered files; `memory-source`: the agent's memory; `agent-link-block`: Orca's block in an agent file. */
export const AGENT_MEMORY_FILE_CHANGE_OWNERS = [
  'orca',
  'memory-source',
  'agent-link-block'
] as const
export type AgentMemoryFileChangeOwner = (typeof AGENT_MEMORY_FILE_CHANGE_OWNERS)[number]

/** One exact file change shown before the user confirms. */
export type AgentMemoryFileChange = {
  kind: AgentMemoryFileChangeKind
  path: string
  owner: AgentMemoryFileChangeOwner
  /** Destination for `move`. */
  toPath?: string
  beforeText: string | null
  afterText: string | null
}

export type AgentMemoryDecisionRequest = {
  scope: AgentMemoryScopeRequest
  itemId: string
  contentHash: string
  decision: AgentMemoryDecision
  shares?: AgentMemoryAgent[]
  mergeTargetId?: string
  /** EDIT only: the new memory text. */
  editedText?: string
}

export type AgentMemoryDecisionPreview = {
  requests: AgentMemoryDecisionRequest[]
  fileChanges: AgentMemoryFileChange[]
  /** Requests that cannot apply (e.g. content changed since listing), with reasons. */
  rejected: { itemId: string; reason: string }[]
  /** E.g. an agent file whose Orca block was edited by hand and is left alone. */
  warnings: string[]
  /** Apply refuses the batch when its re-planned changes differ from this preview. */
  previewFingerprint: string
}

export type AgentMemoryApplyDecisionsRequest = {
  requests: AgentMemoryDecisionRequest[]
  previewFingerprint: string
}

export type AgentMemorySuggestionRequest = {
  scope: AgentMemoryScopeRequest
  itemId: string
  verdict: AgentMemorySuggestionVerdict
  reason: string
  by: string
  mergeTargetId?: string
}

export type AgentMemoryPreferences = {
  /** Project memories become unreviewed this many days after review; null is off. */
  projectReviewExpiryDays: number | null
}

export type AgentMemoryDecisionResult = {
  applied: string[]
  rejected: { itemId: string; reason: string }[]
  /** Undo token covering the whole batch; null when nothing changed. */
  undoId: string | null
}

export type AgentMemoryUndoResult = {
  restoredFiles: string[]
  restoredRecords: string[]
}
