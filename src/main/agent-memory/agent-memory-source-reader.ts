import type {
  AgentMemoryAgent,
  AgentMemorySourceKind,
  AgentMemoryType
} from '../../shared/agent-memory/agent-memory-types'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'

/** One memory as a reader found it, before dedupe and review lookup. */
export type AgentMemorySourceEntry = {
  id: string
  sourceKind: AgentMemorySourceKind
  nativeAgent: AgentMemoryAgent
  title: string
  description: string
  type: AgentMemoryType
  text: string
  /** File holding the memory (the section's file for sections). */
  path: string
  sectionKey: string | null
  worktreePath: string | null
  modifiedAt: string
  editable: boolean
  nativeArchive: boolean
  /** `.memory-review.json` that holds this source's record. */
  reviewFilePath: string
}

export type AgentMemoryWorkspaceContext = {
  /** Main checkout of the repo. */
  repoPath: string
  /** Every other worktree of the repo. */
  worktreePaths: string[]
  /** Ref the in-repo files are read from, e.g. `origin/main`; null when unresolved. */
  baseRef: string | null
  readFileAtBaseRef: (relativePath: string) => Promise<string | null>
}

/** One reader per memory source; Gemini, OpenCode and Pi readers plug in here later. */
export type AgentMemorySourceReader = {
  sourceKind: AgentMemorySourceKind
  readGlobal?: (environment: AgentMemoryAdapterEnvironment) => Promise<AgentMemorySourceEntry[]>
  readWorkspace?: (
    environment: AgentMemoryAdapterEnvironment,
    workspace: AgentMemoryWorkspaceContext
  ) => Promise<AgentMemorySourceEntry[]>
}

export const MEMORY_REVIEW_FILE_NAME = '.memory-review.json'
