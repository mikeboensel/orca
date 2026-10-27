import { join, resolve } from 'node:path'
import { isPlainObject } from '../../shared/agent-memory/agent-memory-document-format'
import { validateAgentMemoryNewDraft } from '../../shared/agent-memory/agent-memory-draft-validation'
import type {
  AgentMemoryApplyDecisionsRequest,
  AgentMemoryDecisionPreview,
  AgentMemoryDecisionRequest,
  AgentMemoryDecisionResult,
  AgentMemoryListing,
  AgentMemoryPreferences,
  AgentMemoryScopeRequest,
  AgentMemorySuggestionRequest,
  AgentMemoryUndoResult
} from '../../shared/agent-memory/agent-memory-review-types'
import type {
  AgentMemoryApplyOptions,
  AgentMemoryApplyResult,
  AgentMemorySyncPlan
} from '../../shared/agent-memory/agent-memory-sync-types'
import type {
  AgentMemoryHistoryEntry,
  AgentMemoryItem
} from '../../shared/agent-memory/agent-memory-types'
import { agentMemoryLinkAdapters } from './agent-memory-adapter-registry'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import { AgentMemoryFileChangeBatch, applyFileChanges } from './agent-memory-file-change-batch'
import { readTextFileOrNull, writeTextFileAtomically } from './agent-memory-file-io'
import { planMemoryTextEdit } from './agent-memory-native-file-changes'
import { createClaudeProjectMemory } from './agent-memory-new-claude-memory'
import { AgentMemoryPullRequestStateCache } from './agent-memory-pull-request-state-cache'
import {
  applyAgentMemoryDecisions,
  previewAgentMemoryDecisions,
  undoAgentMemoryDecisions,
  type AgentMemoryDecisionContext
} from './agent-memory-review-decisions'
import { readReviewRecords } from './agent-memory-review-file'
import { listAgentMemoryScope, reviewFilePathsForScope } from './agent-memory-scope-listing'
import {
  importAuditSuggestions,
  suggestAgentMemory,
  type AgentMemoryAuditImportResult
} from './agent-memory-suggestions'
import { refreshRenderedScopeForPausedShares } from './agent-memory-sharing-plan'
import { applyAgentMemorySyncTargets } from './agent-memory-sync-applier'
import { planAgentMemorySync } from './agent-memory-sync-planner'

/** Orca-owned state: rendered shared files, undo journals, PR cache, preferences. */
export function resolveAgentMemoryStoreRoot(userDataPath: string): string {
  return join(userDataPath, 'agent-memory')
}

const DEFAULT_PREFERENCES: AgentMemoryPreferences = { projectReviewExpiryDays: null }

export type AgentMemoryServiceOptions = {
  storeRootDirectory: string
  environment: AgentMemoryAdapterEnvironment
  now?: () => Date
  /** Configured base ref per main checkout, from Orca's repo settings. */
  resolveRepoBaseRef?: (repoPath: string) => string | null | undefined
}

/** View over each agent's own memory files plus the user's review state; agents' files stay canonical. */
export class AgentMemoryService {
  private readonly now: () => Date
  private readonly pullRequestStateCache: AgentMemoryPullRequestStateCache

  constructor(private readonly options: AgentMemoryServiceOptions) {
    this.now = options.now ?? (() => new Date())
    this.pullRequestStateCache = AgentMemoryPullRequestStateCache.inStoreRoot(
      options.storeRootDirectory
    )
  }

  private get preferencesPath(): string {
    return join(this.options.storeRootDirectory, 'preferences.json')
  }

  async getPreferences(): Promise<AgentMemoryPreferences> {
    const text = await readTextFileOrNull(this.preferencesPath)
    try {
      const parsed: unknown = text ? JSON.parse(text) : {}
      const days = isPlainObject(parsed) ? parsed.projectReviewExpiryDays : null
      return {
        projectReviewExpiryDays: typeof days === 'number' && days > 0 ? Math.floor(days) : null
      }
    } catch {
      return DEFAULT_PREFERENCES
    }
  }

  async setPreferences(preferences: AgentMemoryPreferences): Promise<AgentMemoryPreferences> {
    const days = preferences.projectReviewExpiryDays
    const next = {
      projectReviewExpiryDays: typeof days === 'number' && days > 0 ? Math.floor(days) : null
    }
    await writeTextFileAtomically(this.preferencesPath, `${JSON.stringify(next, null, 2)}\n`)
    return next
  }

  async list(scope: AgentMemoryScopeRequest, checkStaleness = true): Promise<AgentMemoryListing> {
    const normalized = normalizeScope(scope)
    const listing = await listAgentMemoryScope(
      normalized,
      {
        environment: this.options.environment,
        pullRequestStateCache: this.pullRequestStateCache,
        projectReviewExpiryDays: (await this.getPreferences()).projectReviewExpiryDays,
        now: this.now
      },
      {
        checkStaleness,
        repoBaseRef:
          normalized.kind === 'workspace'
            ? this.options.resolveRepoBaseRef?.(normalized.repoPath)
            : null
      }
    )
    await refreshRenderedScopeForPausedShares(this.options.storeRootDirectory, listing)
    return listing
  }

  async show(scope: AgentMemoryScopeRequest, itemId: string): Promise<AgentMemoryItem> {
    const item = (await this.list(scope)).items.find((candidate) => candidate.id === itemId)
    if (!item) {
      throw new Error(`No memory ${itemId} in this scope`)
    }
    return item
  }

  /** Includes archived and deleted sources, whose records stay in the review file as history. */
  async history(
    scope: AgentMemoryScopeRequest,
    itemId: string
  ): Promise<AgentMemoryHistoryEntry[]> {
    const listing = await this.list(scope, false)
    const item = listing.items.find((candidate) => candidate.id === itemId)
    if (item) {
      return item.record?.history ?? []
    }
    for (const path of await reviewFilePathsForScope(listing.scope, this.options.environment)) {
      const record = (await readReviewRecords(path))[itemId]
      if (record) {
        return record.history
      }
    }
    throw new Error(`No memory or review history for ${itemId} in this scope`)
  }

  private decisionContext(): AgentMemoryDecisionContext {
    return {
      storeRootDirectory: this.options.storeRootDirectory,
      environment: this.options.environment,
      now: this.now,
      listScope: (scope) => this.list(scope)
    }
  }

  previewDecisions(requests: AgentMemoryDecisionRequest[]): Promise<AgentMemoryDecisionPreview> {
    return previewAgentMemoryDecisions(this.decisionContext(), requests.map(normalizeRequest))
  }

  applyDecisions(request: AgentMemoryApplyDecisionsRequest): Promise<AgentMemoryDecisionResult> {
    return applyAgentMemoryDecisions(this.decisionContext(), {
      ...request,
      requests: request.requests.map(normalizeRequest)
    })
  }

  undo(undoId: string): Promise<AgentMemoryUndoResult> {
    return undoAgentMemoryDecisions(this.decisionContext(), undoId)
  }

  async suggest(request: AgentMemorySuggestionRequest): Promise<AgentMemoryItem> {
    return suggestAgentMemory(await this.list(request.scope, false), request, this.now())
  }

  async suggestFromAudit(
    scope: AgentMemoryScopeRequest,
    auditText: string,
    by: string
  ): Promise<AgentMemoryAuditImportResult> {
    return importAuditSuggestions(await this.list(scope, false), auditText, by, this.now())
  }

  /** New memories start unreviewed; only Claude project memory can be added to. */
  async add(scope: AgentMemoryScopeRequest, input: unknown): Promise<string> {
    if (scope.kind !== 'workspace') {
      throw new Error(
        'New memories go to a workspace; edit ~/.claude/CLAUDE.md or ~/.codex/AGENTS.md for global ones'
      )
    }
    const validation = validateAgentMemoryNewDraft(input)
    if (!validation.ok) {
      throw new Error(validation.reason)
    }
    return createClaudeProjectMemory(
      this.options.environment,
      resolve(scope.repoPath),
      validation.draft
    )
  }

  /** Rewrites the source text without reviewing it, so the change shows up as unreviewed. */
  async editText(
    scope: AgentMemoryScopeRequest,
    itemId: string,
    text: string
  ): Promise<AgentMemoryItem> {
    const item = await this.show(scope, itemId)
    if (!item.editable) {
      throw new Error('This source is read from main; edit it in a branch')
    }
    const batch = new AgentMemoryFileChangeBatch()
    await planMemoryTextEdit(batch, item, text)
    await applyFileChanges(batch.changes)
    return item
  }

  planSync(): Promise<AgentMemorySyncPlan> {
    return planAgentMemorySync({
      storeRootDirectory: this.options.storeRootDirectory,
      adapters: agentMemoryLinkAdapters(),
      environment: this.options.environment
    })
  }

  async applySync(options: AgentMemoryApplyOptions): Promise<AgentMemoryApplyResult> {
    return applyAgentMemorySyncTargets((await this.planSync()).targets, options)
  }
}

function normalizeScope(scope: AgentMemoryScopeRequest): AgentMemoryScopeRequest {
  return scope.kind === 'workspace'
    ? { kind: 'workspace', repoPath: resolve(scope.repoPath) }
    : scope
}

function normalizeRequest(request: AgentMemoryDecisionRequest): AgentMemoryDecisionRequest {
  return { ...request, scope: normalizeScope(request.scope) }
}
