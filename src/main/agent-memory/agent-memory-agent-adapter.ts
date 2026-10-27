import type { AgentMemoryTargetWarning } from '../../shared/agent-memory/agent-memory-sync-types'
import type { AgentMemoryAgent } from '../../shared/agent-memory/agent-memory-types'

/** Where an agent's config lives; tests inject a temp home so real dotfiles are never touched. */
export type AgentMemoryAdapterEnvironment = {
  homeDirectory: string
  processEnvironment: NodeJS.ProcessEnv
}

/** Rendered files one agent should load: global always, repo files only inside that repo. */
export type AgentMemoryLinks = {
  globalPath: string | null
  /** `gitCommonDirectory` is what `git rev-parse --git-common-dir` prints in any worktree of the repo. */
  repos: { repoPath: string; gitCommonDirectory: string; renderedPath: string }[]
}

/** One per agent: where its user-level instructions live and how it is told to load a file. */
export type AgentMemoryAgentAdapter = {
  agent: AgentMemoryAgent
  describeInstructionFile: (
    environment: AgentMemoryAdapterEnvironment
  ) => Promise<{ path: string; warnings: AgentMemoryTargetWarning[] }>
  /** Inner text of the Orca block; never called with no links. */
  renderLinkBlock: (links: AgentMemoryLinks) => string
}

export const AGENT_MEMORY_BLOCK_NOTICE =
  '<!-- Managed by Orca (Memory panel). It links memories shared from other agents; change sharing in Orca, not here. -->'
