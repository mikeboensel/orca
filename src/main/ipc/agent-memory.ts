import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { isPlainObject } from '../../shared/agent-memory/agent-memory-document-format'
import type {
  AgentMemoryDecisionRequest,
  AgentMemoryPreferences,
  AgentMemoryScopeRequest
} from '../../shared/agent-memory/agent-memory-review-types'
import {
  isAgentMemoryAgent,
  isAgentMemoryDecision
} from '../../shared/agent-memory/agent-memory-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { Repo } from '../../shared/repo-types'
import {
  AgentMemoryService,
  resolveAgentMemoryStoreRoot
} from '../agent-memory/agent-memory-service'
import type { Store } from '../persistence'
import { getTrustedUIRendererWebContents } from './ui'

const MAX_BATCH_SIZE = 500

function localRepos(store: Store): Repo[] {
  return store.getRepos().filter((repo) => getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID)
}

/** Workspace scopes must name a local Orca repo; remote repos' files live on another host. */
function parseScope(store: Store, value: unknown): AgentMemoryScopeRequest {
  if (isPlainObject(value) && value.kind === 'global') {
    return { kind: 'global' }
  }
  if (isPlainObject(value) && value.kind === 'workspace' && typeof value.repoPath === 'string') {
    const repoPath = resolve(value.repoPath)
    if (localRepos(store).some((repo) => resolve(repo.path) === repoPath)) {
      return { kind: 'workspace', repoPath }
    }
    throw new Error(`${value.repoPath} is not a local Orca repo`)
  }
  throw new Error('scope must be { kind: "global" } or { kind: "workspace", repoPath }')
}

function parseDecisionRequest(store: Store, value: unknown): AgentMemoryDecisionRequest {
  if (
    !isPlainObject(value) ||
    typeof value.itemId !== 'string' ||
    typeof value.contentHash !== 'string' ||
    !isAgentMemoryDecision(value.decision)
  ) {
    throw new Error('Invalid memory decision')
  }
  return {
    scope: parseScope(store, value.scope),
    itemId: value.itemId,
    contentHash: value.contentHash,
    decision: value.decision,
    ...(Array.isArray(value.shares) ? { shares: value.shares.filter(isAgentMemoryAgent) } : {}),
    ...(typeof value.mergeTargetId === 'string' ? { mergeTargetId: value.mergeTargetId } : {}),
    ...(typeof value.editedText === 'string' ? { editedText: value.editedText } : {})
  }
}

function parseDecisionRequests(store: Store, value: unknown): AgentMemoryDecisionRequest[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_SIZE) {
    throw new Error(`decisions must be a list of 1 to ${MAX_BATCH_SIZE}`)
  }
  return value.map((request) => parseDecisionRequest(store, request))
}

function parsePreferences(value: unknown): AgentMemoryPreferences {
  const days = isPlainObject(value) ? value.projectReviewExpiryDays : null
  return { projectReviewExpiryDays: typeof days === 'number' ? days : null }
}

function handleTrusted<Result>(
  channel: string,
  listener: (...args: unknown[]) => Promise<Result>
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    // These handlers rewrite agents' memory and instruction files, so only the main UI may call them.
    if (getTrustedUIRendererWebContents() !== event.sender) {
      throw new Error('Unauthorized agent memory IPC sender')
    }
    return listener(...args)
  })
}

export function registerAgentMemoryHandlers(store: Store): void {
  const service = new AgentMemoryService({
    storeRootDirectory: resolveAgentMemoryStoreRoot(app.getPath('userData')),
    environment: { homeDirectory: homedir(), processEnvironment: process.env },
    resolveRepoBaseRef: (repoPath) =>
      localRepos(store).find((repo) => resolve(repo.path) === repoPath)?.worktreeBaseRef
  })

  handleTrusted('agentMemory:list', (scope) => service.list(parseScope(store, scope)))
  handleTrusted('agentMemory:previewDecisions', (requests) =>
    service.previewDecisions(parseDecisionRequests(store, requests))
  )
  handleTrusted('agentMemory:applyDecisions', (request) => {
    if (!isPlainObject(request) || typeof request.previewFingerprint !== 'string') {
      throw new Error('applyDecisions needs the confirmed preview fingerprint')
    }
    return service.applyDecisions({
      requests: parseDecisionRequests(store, request.requests),
      previewFingerprint: request.previewFingerprint
    })
  })
  handleTrusted('agentMemory:undo', (undoId) => {
    if (typeof undoId !== 'string') {
      throw new Error('undoId must be a string')
    }
    return service.undo(undoId)
  })
  handleTrusted('agentMemory:getPreferences', () => service.getPreferences())
  handleTrusted('agentMemory:setPreferences', (preferences) =>
    service.setPreferences(parsePreferences(preferences))
  )
}
