import type { AgentMemoryAgent } from './agent-memory-types'

/** A rendered file is global or belongs to one repo (keyed by its main checkout path). */
export type AgentMemoryRenderedScope = { kind: 'global' } | { kind: 'repo'; repoPath: string }

export const AGENT_MEMORY_TARGET_STATUSES = ['in-sync', 'create', 'update', 'drifted'] as const
export type AgentMemoryTargetStatus = (typeof AGENT_MEMORY_TARGET_STATUSES)[number]

export const AGENT_MEMORY_TARGET_WARNINGS = ['codex-override-shadows-agents-md'] as const
export type AgentMemoryTargetWarning = (typeof AGENT_MEMORY_TARGET_WARNINGS)[number]

/** Orca-owned Markdown holding one scope's shared memories; agent files only link to it. */
export type AgentMemoryRenderedFile = {
  scope: AgentMemoryRenderedScope
  path: string
  memoryCount: number
  /** Characters / 4; Claude loads @imported files into every session, so size is context cost. */
  approximateTokens: number
}

/** One agent's user-level instruction file and the Orca link block planned for it. */
export type AgentMemorySyncTargetPlan = {
  agent: AgentMemoryAgent
  path: string
  status: AgentMemoryTargetStatus
  /** Whole file as read during planning; null when absent. */
  currentFileText: string | null
  /** Fingerprint of `currentFileText` ('absent' for none); apply refuses a target whose file changed. */
  currentFileFingerprint: string
  /** Whole file after apply. */
  nextFileText: string
  /** Scopes whose rendered file the block links for this agent. */
  linkedScopes: AgentMemoryRenderedScope[]
  warnings: AgentMemoryTargetWarning[]
}

export type AgentMemorySyncPlan = {
  targets: AgentMemorySyncTargetPlan[]
  renderedFiles: AgentMemoryRenderedFile[]
}

export const AGENT_MEMORY_APPLY_OUTCOMES = [
  'written',
  'unchanged',
  'skipped-drifted',
  'skipped-changed-since-plan'
] as const
export type AgentMemoryApplyOutcome = (typeof AGENT_MEMORY_APPLY_OUTCOMES)[number]

export type AgentMemoryApplyResult = {
  targets: { path: string; agent: AgentMemoryAgent; outcome: AgentMemoryApplyOutcome }[]
}

export type AgentMemoryPreviewedFile = { path: string; currentFileFingerprint: string }

export type AgentMemoryApplyOptions = {
  /** Files as the user previewed them; a target whose file changed since is skipped. */
  previewedFiles?: AgentMemoryPreviewedFile[]
  /** Drifted target paths the user chose to overwrite with Orca's block. */
  overwriteDriftedPaths?: string[]
}
