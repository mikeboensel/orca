import { createHash } from 'node:crypto'
import type {
  AgentMemoryApplyDecisionsRequest,
  AgentMemoryDecisionPreview,
  AgentMemoryDecisionRequest,
  AgentMemoryDecisionResult,
  AgentMemoryListing,
  AgentMemoryScopeRequest,
  AgentMemoryUndoResult
} from '../../shared/agent-memory/agent-memory-review-types'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import {
  planAgentMemoryDecision,
  type AgentMemoryPlannedDecision
} from './agent-memory-decision-planner'
import {
  AgentMemoryFileChangeBatch,
  AgentMemoryFileChangeConflict,
  applyFileChanges,
  revertFileChanges
} from './agent-memory-file-change-batch'
import { emptyReviewRecord, updateReviewRecords } from './agent-memory-review-file'
import { planSharingForScope } from './agent-memory-sharing-plan'
import {
  readUndoJournal,
  removeUndoJournal,
  writeUndoJournal,
  type RecordSnapshot
} from './agent-memory-undo-journal'

export type AgentMemoryDecisionContext = {
  storeRootDirectory: string
  environment: AgentMemoryAdapterEnvironment
  now: () => Date
  /** A fresh listing with staleness, so KEEP acknowledges what the user was shown. */
  listScope: (scope: AgentMemoryScopeRequest) => Promise<AgentMemoryListing>
}

type BatchPlan = {
  batch: AgentMemoryFileChangeBatch
  planned: AgentMemoryPlannedDecision[]
  rejected: { itemId: string; reason: string }[]
  warnings: string[]
}

function scopeKey(scope: AgentMemoryScopeRequest): string {
  return scope.kind === 'global' ? 'global' : `workspace:${scope.repoPath}`
}

async function planBatch(
  context: AgentMemoryDecisionContext,
  requests: readonly AgentMemoryDecisionRequest[]
): Promise<BatchPlan> {
  if (requests.length === 0) {
    throw new Error('No decisions to apply')
  }
  if (new Set(requests.map((request) => scopeKey(request.scope))).size > 1) {
    throw new Error('One batch can only hold decisions for one scope')
  }
  const listing = await context.listScope(requests[0].scope)
  const batch = new AgentMemoryFileChangeBatch()
  const planned: AgentMemoryPlannedDecision[] = []
  const rejected: BatchPlan['rejected'] = []
  for (const request of requests) {
    if (planned.some((decision) => decision.item.id === request.itemId)) {
      rejected.push({ itemId: request.itemId, reason: 'decided twice in one batch' })
      continue
    }
    const restore = batch.checkpoint()
    try {
      planned.push(await planAgentMemoryDecision(batch, request, listing, context.now()))
    } catch (error) {
      restore()
      if (!(error instanceof AgentMemoryFileChangeConflict)) {
        throw error
      }
      rejected.push({ itemId: request.itemId, reason: error.message })
    }
  }
  const warnings = [
    ...listing.warnings,
    ...(await planSharingForScope(batch, {
      storeRootDirectory: context.storeRootDirectory,
      environment: context.environment,
      listing,
      planned
    }))
  ]
  return { batch, planned, rejected, warnings }
}

function fingerprint(plan: BatchPlan): string {
  const changes = plan.batch.changes.map((change) => [
    change.kind,
    change.path,
    change.toPath ?? null,
    change.beforeText,
    change.afterText
  ])
  const decisions = plan.planned.map((decision) => [decision.recordId, decision.record.decision])
  return createHash('sha256')
    .update(JSON.stringify([changes, decisions]))
    .digest('hex')
}

export async function previewAgentMemoryDecisions(
  context: AgentMemoryDecisionContext,
  requests: AgentMemoryDecisionRequest[]
): Promise<AgentMemoryDecisionPreview> {
  const plan = await planBatch(context, requests)
  return {
    requests: plan.planned.map((decision) => decision.request),
    fileChanges: plan.batch.changes,
    rejected: plan.rejected,
    warnings: plan.warnings,
    previewFingerprint: fingerprint(plan)
  }
}

/** Re-plans against current files and applies only if that equals the confirmed preview. */
export async function applyAgentMemoryDecisions(
  context: AgentMemoryDecisionContext,
  request: AgentMemoryApplyDecisionsRequest
): Promise<AgentMemoryDecisionResult> {
  const plan = await planBatch(context, request.requests)
  if (fingerprint(plan) !== request.previewFingerprint) {
    throw new Error('Memories or files changed since the preview; review the changes again')
  }
  await applyFileChanges(plan.batch.changes)
  const snapshots: RecordSnapshot[] = []
  const byReviewFile = Map.groupBy(plan.planned, (decision) => decision.item.reviewFilePath)
  for (const [reviewFilePath, decisions] of byReviewFile) {
    await updateReviewRecords(reviewFilePath, (records) => {
      for (const decision of decisions) {
        snapshots.push({
          reviewFilePath,
          recordId: decision.recordId,
          before: records[decision.recordId] ?? null
        })
        records[decision.recordId] = decision.record
      }
    })
  }
  let undoId: string | null = null
  if (snapshots.length > 0 || plan.batch.changes.length > 0) {
    undoId = await writeUndoJournal(context.storeRootDirectory, {
      fileChanges: plan.batch.changes,
      records: snapshots
    })
  }
  return {
    applied: plan.planned.map((decision) => decision.item.id),
    rejected: plan.rejected,
    undoId
  }
}

/** Restores files and records; refuses when any file changed after the decision. */
export async function undoAgentMemoryDecisions(
  context: Pick<AgentMemoryDecisionContext, 'storeRootDirectory' | 'now'>,
  undoId: string
): Promise<AgentMemoryUndoResult> {
  const journal = await readUndoJournal(context.storeRootDirectory, undoId)
  const restoredFiles = await revertFileChanges(journal.fileChanges)
  const at = context.now().toISOString()
  for (const [reviewFilePath, snapshots] of Map.groupBy(
    journal.records,
    (snapshot) => snapshot.reviewFilePath
  )) {
    await updateReviewRecords(reviewFilePath, (records) => {
      for (const snapshot of snapshots.toReversed()) {
        const current = records[snapshot.recordId]
        const restored = snapshot.before ?? emptyReviewRecord(current?.contentHash ?? '')
        records[snapshot.recordId] = {
          ...restored,
          history: [
            ...(current?.history ?? restored.history),
            {
              at,
              event: 'UNDONE',
              contentHash: restored.contentHash,
              ...(current?.decision ? { decision: current.decision } : {})
            }
          ]
        }
      }
    })
  }
  await removeUndoJournal(context.storeRootDirectory, undoId)
  return { restoredFiles, restoredRecords: journal.records.map((snapshot) => snapshot.recordId) }
}
