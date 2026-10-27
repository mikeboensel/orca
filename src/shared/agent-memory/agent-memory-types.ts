import type { TuiAgent } from '../tui-agent'

/** Claude's auto-memory taxonomy plus `instruction` for sections of CLAUDE.md / AGENTS.md. */
export const AGENT_MEMORY_TYPES = [
  'user',
  'feedback',
  'project',
  'reference',
  'instruction'
] as const
export type AgentMemoryType = (typeof AGENT_MEMORY_TYPES)[number]

/** Agents shown as sharing chips; ids match Orca's TuiAgent ids. */
export const AGENT_MEMORY_AGENTS = [
  'claude',
  'codex',
  'gemini',
  'opencode',
  'pi'
] as const satisfies readonly TuiAgent[]
export type AgentMemoryAgent = (typeof AGENT_MEMORY_AGENTS)[number]

export const AGENT_MEMORY_SCOPE_KINDS = ['global', 'workspace'] as const
export type AgentMemoryScopeKind = (typeof AGENT_MEMORY_SCOPE_KINDS)[number]

/** Where a memory lives; each kind has one reader. */
export const AGENT_MEMORY_SOURCE_KINDS = [
  'claude-project-memory-file',
  'claude-user-instructions-section',
  'codex-user-instructions-section',
  'repo-claude-md-section',
  'repo-agents-md-section'
] as const
export type AgentMemorySourceKind = (typeof AGENT_MEMORY_SOURCE_KINDS)[number]

export const AGENT_MEMORY_DECISIONS = [
  'KEEP',
  'SHARE',
  'ARCHIVE',
  'MERGE',
  'EDIT',
  'DELETE'
] as const
export type AgentMemoryDecision = (typeof AGENT_MEMORY_DECISIONS)[number]

/** What an agent may propose; only the user turns a verdict into a decision. */
export const AGENT_MEMORY_SUGGESTION_VERDICTS = [...AGENT_MEMORY_DECISIONS, 'NEEDS_REVIEW'] as const
export type AgentMemorySuggestionVerdict = (typeof AGENT_MEMORY_SUGGESTION_VERDICTS)[number]

export const AGENT_MEMORY_UNREVIEWED_REASONS = [
  'NO_RECORD',
  'CONTENT_CHANGED',
  'PR_MERGED',
  'PR_CLOSED',
  'PATH_MISSING_ON_MAIN',
  'REVIEW_EXPIRED'
] as const
export type AgentMemoryUnreviewedReason = (typeof AGENT_MEMORY_UNREVIEWED_REASONS)[number]

export const AGENT_MEMORY_HISTORY_EVENTS = [
  'DECIDED',
  'SUGGESTED',
  'UNDONE',
  'EDITED',
  'RENAMED',
  'SHARES_CHANGED',
  'SOURCE_GONE'
] as const
export type AgentMemoryHistoryEvent = (typeof AGENT_MEMORY_HISTORY_EVENTS)[number]

/** `paused`: shared, but the memory changed since its SHARE review, so it is left out of shared files. */
export const AGENT_MEMORY_SHARE_STATES = [
  'native',
  'shared',
  'paused',
  'not-shared',
  'unavailable'
] as const
export type AgentMemoryShareState = (typeof AGENT_MEMORY_SHARE_STATES)[number]

export type AgentMemorySuggestion = {
  verdict: AgentMemorySuggestionVerdict
  reason: string
  /** Who suggested it, e.g. `codex`, `claude`, `audit:memory-audit.json`. */
  by: string
  at: string
  mergeTarget?: string
}

export type AgentMemoryHistoryEntry = {
  at: string
  event: AgentMemoryHistoryEvent
  contentHash: string
  decision?: AgentMemoryDecision
  shares?: AgentMemoryAgent[]
  verdict?: AgentMemorySuggestionVerdict
  by?: string
  note?: string
}

/** One source's review state, stored in `.memory-review.json` beside the source. */
export type AgentMemoryReviewRecord = {
  contentHash: string
  reviewedAt?: string
  decision?: AgentMemoryDecision
  shares: AgentMemoryAgent[]
  mergeTarget?: string
  suggestion?: AgentMemorySuggestion
  /** Stale findings the user saw and kept anyway, e.g. `PR:org/repo#12`, `PATH:src/a.ts`. */
  acknowledgedStaleness: string[]
  sourceGone?: boolean
  history: AgentMemoryHistoryEntry[]
}

export type AgentMemoryStaleFinding = {
  reason: Extract<AgentMemoryUnreviewedReason, 'PR_MERGED' | 'PR_CLOSED' | 'PATH_MISSING_ON_MAIN'>
  /** Stable key, also stored in `acknowledgedStaleness` when the user keeps the memory. */
  key: string
  detail: string
}

export type AgentMemoryLocation = {
  path: string
  /** Worktree whose Claude project dir holds this copy; null for the main checkout or global files. */
  worktreePath: string | null
}

export type AgentMemoryItem = {
  /** Source id: agent-specific, stable across worktrees (e.g. `claude-memory:feedback_x.md`). */
  id: string
  sourceKind: AgentMemorySourceKind
  nativeAgent: AgentMemoryAgent
  scope: AgentMemoryScopeKind
  title: string
  description: string
  type: AgentMemoryType
  text: string
  contentHash: string
  sizeBytes: number
  modifiedAt: string
  /** Every copy with this content; length is "seen in N worktrees". */
  locations: AgentMemoryLocation[]
  sectionHeading: string | null
  /** False for in-repo files read from main and for non-file sources Orca cannot rewrite. */
  editable: boolean
  /** True when ARCHIVE/DELETE change files (Claude memory files only). */
  nativeArchive: boolean
  reviewFilePath: string
  record: AgentMemoryReviewRecord | null
  unreviewedReasons: AgentMemoryUnreviewedReason[]
  staleFindings: AgentMemoryStaleFinding[]
  shareStates: Record<AgentMemoryAgent, AgentMemoryShareState>
}

export function isAgentMemoryType(value: unknown): value is AgentMemoryType {
  return AGENT_MEMORY_TYPES.some((type) => type === value)
}

export function isAgentMemoryAgent(value: unknown): value is AgentMemoryAgent {
  return AGENT_MEMORY_AGENTS.some((agent) => agent === value)
}

export function isAgentMemoryDecision(value: unknown): value is AgentMemoryDecision {
  return AGENT_MEMORY_DECISIONS.some((decision) => decision === value)
}

export function isAgentMemorySuggestionVerdict(
  value: unknown
): value is AgentMemorySuggestionVerdict {
  return AGENT_MEMORY_SUGGESTION_VERDICTS.some((verdict) => verdict === value)
}
