import { join, resolve } from 'node:path'
import type {
  AgentMemoryListing,
  AgentMemoryScopeRequest
} from '../../shared/agent-memory/agent-memory-review-types'
import type { AgentMemoryAgent } from '../../shared/agent-memory/agent-memory-types'
import { AGENT_MEMORY_LINK_ADAPTERS } from './agent-memory-adapter-registry'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import { buildAgentMemoryItems } from './agent-memory-catalog'
import {
  CLAUDE_PROJECT_MEMORY_READER,
  claudeProjectMemoryDirectory
} from './agent-memory-claude-project-memory-reader'
import {
  CLAUDE_USER_INSTRUCTIONS_READER,
  CODEX_USER_INSTRUCTIONS_READER,
  REPO_AGENTS_MD_READER,
  REPO_CLAUDE_MD_READER,
  REPO_MEMORY_REVIEW_FILE_NAME
} from './agent-memory-instruction-section-readers'
import type { AgentMemoryPullRequestStateCache } from './agent-memory-pull-request-state-cache'
import {
  listLinkedWorktreePaths,
  listRepoFilesAtRef,
  readRepoFileAtRef,
  resolveAgentMemoryBaseRef
} from './agent-memory-repo-git'
import {
  MEMORY_REVIEW_FILE_NAME,
  type AgentMemorySourceEntry,
  type AgentMemorySourceReader,
  type AgentMemoryWorkspaceContext
} from './agent-memory-source-reader'
import { resolveClaudeCodeHome } from './claude-code-agent-memory-adapter'
import { resolveCodexSystemHome } from './codex-agent-memory-adapter'
import type { AgentMemoryStalenessDependencies } from './agent-memory-staleness'

const GLOBAL_READERS: readonly AgentMemorySourceReader[] = [
  CLAUDE_USER_INSTRUCTIONS_READER,
  CODEX_USER_INSTRUCTIONS_READER
]
const WORKSPACE_READERS: readonly AgentMemorySourceReader[] = [
  CLAUDE_PROJECT_MEMORY_READER,
  REPO_CLAUDE_MD_READER,
  REPO_AGENTS_MD_READER
]

export type AgentMemoryScopeListingDependencies = {
  environment: AgentMemoryAdapterEnvironment
  pullRequestStateCache: AgentMemoryPullRequestStateCache
  projectReviewExpiryDays: number | null
  now: () => Date
}

export type AgentMemoryScopeListingOptions = {
  /** The repo's configured worktree base ref; the remote default is used when absent. */
  repoBaseRef?: string | null
  /** False skips git/gh staleness probes, e.g. when re-listing to plan a decision. */
  checkStaleness: boolean
}

export function linkableAgentMemoryAgents(): AgentMemoryAgent[] {
  return Object.keys(AGENT_MEMORY_LINK_ADAPTERS).filter(
    (agent): agent is AgentMemoryAgent => agent in AGENT_MEMORY_LINK_ADAPTERS
  )
}

/** Folder workspaces and repos without a resolvable base ref list only Claude project memory. */
export async function resolveWorkspaceContext(
  repoPath: string,
  repoBaseRef: string | null | undefined
): Promise<AgentMemoryWorkspaceContext> {
  const mainPath = resolve(repoPath)
  const worktreePaths = (await listLinkedWorktreePaths(mainPath)).filter(
    (path) => path !== mainPath
  )
  const baseRef = await resolveAgentMemoryBaseRef(mainPath, repoBaseRef).catch(() => null)
  return {
    repoPath: mainPath,
    worktreePaths,
    baseRef,
    readFileAtBaseRef: async (relativePath) =>
      baseRef ? readRepoFileAtRef(mainPath, baseRef, relativePath) : null
  }
}

async function readEntries(
  scope: AgentMemoryScopeRequest,
  environment: AgentMemoryAdapterEnvironment,
  workspace: AgentMemoryWorkspaceContext | null,
  warnings: string[]
): Promise<AgentMemorySourceEntry[]> {
  const entries: AgentMemorySourceEntry[] = []
  for (const reader of scope.kind === 'global' ? GLOBAL_READERS : WORKSPACE_READERS) {
    try {
      if (scope.kind === 'global' && reader.readGlobal) {
        entries.push(...(await reader.readGlobal(environment)))
      } else if (workspace && reader.readWorkspace) {
        entries.push(...(await reader.readWorkspace(environment, workspace)))
      }
    } catch (error) {
      // One unreadable source must not hide the others.
      warnings.push(
        `${reader.sourceKind}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  return entries
}

async function stalenessFor(
  workspace: AgentMemoryWorkspaceContext | null,
  dependencies: AgentMemoryScopeListingDependencies,
  checkStaleness: boolean
): Promise<AgentMemoryStalenessDependencies> {
  if (!checkStaleness) {
    return { baseRefFiles: null, fetchPullRequestState: async () => null }
  }
  const baseRefFiles = workspace?.baseRef
    ? await listRepoFilesAtRef(workspace.repoPath, workspace.baseRef)
    : null
  return {
    baseRefFiles,
    // A bare `PR #12` in a global file names no repo, so only URL references are checked there.
    fetchPullRequestState: async (reference) =>
      workspace
        ? dependencies.pullRequestStateCache.getState(workspace.repoPath, reference)
        : reference.repository
          ? dependencies.pullRequestStateCache.getState(
              dependencies.environment.homeDirectory,
              reference
            )
          : null
  }
}

/** Every review file the scope's sources use, including ones whose memories are all archived. */
export async function reviewFilePathsForScope(
  scope: AgentMemoryScopeRequest,
  environment: AgentMemoryAdapterEnvironment
): Promise<string[]> {
  if (scope.kind === 'global') {
    return [
      join(resolveClaudeCodeHome(environment), MEMORY_REVIEW_FILE_NAME),
      join(resolveCodexSystemHome(environment), MEMORY_REVIEW_FILE_NAME)
    ]
  }
  const workspace = await resolveWorkspaceContext(scope.repoPath, null)
  return [
    ...[workspace.repoPath, ...workspace.worktreePaths].map((checkout) =>
      join(claudeProjectMemoryDirectory(environment, checkout), MEMORY_REVIEW_FILE_NAME)
    ),
    join(workspace.repoPath, '.git', REPO_MEMORY_REVIEW_FILE_NAME)
  ]
}

export async function listAgentMemoryScope(
  scope: AgentMemoryScopeRequest,
  dependencies: AgentMemoryScopeListingDependencies,
  options: AgentMemoryScopeListingOptions
): Promise<AgentMemoryListing> {
  const warnings: string[] = []
  const workspace =
    scope.kind === 'workspace'
      ? await resolveWorkspaceContext(scope.repoPath, options.repoBaseRef)
      : null
  const entries = await readEntries(scope, dependencies.environment, workspace, warnings)
  const linkableAgents = linkableAgentMemoryAgents()
  const items = await buildAgentMemoryItems(entries, {
    scope: scope.kind,
    linkableAgents,
    staleness: await stalenessFor(workspace, dependencies, options.checkStaleness),
    projectReviewExpiryDays: dependencies.projectReviewExpiryDays,
    now: dependencies.now()
  })
  return {
    scope,
    items,
    unreviewedCount: items.filter((item) => item.unreviewedReasons.length > 0).length,
    linkableAgents,
    baseRef: workspace?.baseRef ?? null,
    warnings
  }
}
