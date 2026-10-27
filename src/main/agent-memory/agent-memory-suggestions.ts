import { basename } from 'node:path'
import { isPlainObject } from '../../shared/agent-memory/agent-memory-document-format'
import type {
  AgentMemoryListing,
  AgentMemorySuggestionRequest
} from '../../shared/agent-memory/agent-memory-review-types'
import {
  isAgentMemorySuggestionVerdict,
  type AgentMemoryItem,
  type AgentMemorySuggestion,
  type AgentMemorySuggestionVerdict
} from '../../shared/agent-memory/agent-memory-types'
import { emptyReviewRecord, updateReviewRecords } from './agent-memory-review-file'

const SUGGESTION_REASON_MAX_LENGTH = 1_000

/** Audit verdicts outside Orca's enum, mapped to the nearest one; the original stays in the reason. */
const AUDIT_VERDICT_ALIASES: Record<string, AgentMemorySuggestionVerdict> = {
  REVIEW: 'NEEDS_REVIEW',
  CLAUDE_ONLY: 'KEEP',
  DUPLICATE_OF_CLAUDE_MD: 'ARCHIVE'
}

export type AgentMemoryAuditImportResult = {
  applied: string[]
  /** Audit entries naming a memory this scope does not have. */
  unmatched: string[]
  invalid: string[]
}

type PendingSuggestion = { item: AgentMemoryItem; suggestion: AgentMemorySuggestion }

/** Suggestions never decide: they leave reviewedAt, decision and shares untouched. */
async function writeSuggestions(pending: readonly PendingSuggestion[]): Promise<void> {
  for (const [reviewFilePath, group] of Map.groupBy(
    pending,
    (entry) => entry.item.reviewFilePath
  )) {
    await updateReviewRecords(reviewFilePath, (records) => {
      for (const { item, suggestion } of group) {
        const record = records[item.id] ?? item.record ?? emptyReviewRecord(item.contentHash)
        records[item.id] = {
          ...record,
          suggestion,
          history: [
            ...record.history,
            {
              at: suggestion.at,
              event: 'SUGGESTED',
              contentHash: item.contentHash,
              verdict: suggestion.verdict,
              by: suggestion.by
            }
          ]
        }
      }
    })
  }
}

function mergeTargetId(
  listing: AgentMemoryListing,
  reference: string | undefined
): string | undefined {
  if (!reference) {
    return undefined
  }
  return findItem(listing, reference)?.id ?? reference
}

/** Matches an id, or a Claude memory file name as audits name them. */
function findItem(listing: AgentMemoryListing, reference: string): AgentMemoryItem | undefined {
  return (
    listing.items.find((item) => item.id === reference) ??
    listing.items.find((item) =>
      item.locations.some((location) => basename(location.path) === reference)
    )
  )
}

export async function suggestAgentMemory(
  listing: AgentMemoryListing,
  request: AgentMemorySuggestionRequest,
  now: Date
): Promise<AgentMemoryItem> {
  const item = findItem(listing, request.itemId)
  if (!item) {
    throw new Error(`No memory ${request.itemId} in this scope`)
  }
  if (!isAgentMemorySuggestionVerdict(request.verdict)) {
    throw new Error('Unknown verdict')
  }
  await writeSuggestions([
    {
      item,
      suggestion: {
        verdict: request.verdict,
        reason: request.reason.trim().slice(0, SUGGESTION_REASON_MAX_LENGTH),
        by: request.by,
        at: now.toISOString(),
        ...(request.mergeTargetId
          ? { mergeTarget: mergeTargetId(listing, request.mergeTargetId) }
          : {})
      }
    }
  ])
  return item
}

/** Loads `[{ file | id, verdict, reason, mergeTarget }]`, e.g. a memory audit, as suggestions. */
export async function importAuditSuggestions(
  listing: AgentMemoryListing,
  auditText: string,
  by: string,
  now: Date
): Promise<AgentMemoryAuditImportResult> {
  const parsed: unknown = JSON.parse(auditText)
  const entries = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.suggestions)
      ? parsed.suggestions
      : null
  if (!entries) {
    throw new Error('Expected a JSON array of { file | id, verdict, reason } entries')
  }
  const result: AgentMemoryAuditImportResult = { applied: [], unmatched: [], invalid: [] }
  const pending: PendingSuggestion[] = []
  for (const entry of entries) {
    const reference = isPlainObject(entry)
      ? typeof entry.id === 'string'
        ? entry.id
        : typeof entry.file === 'string'
          ? entry.file
          : null
      : null
    const rawVerdict =
      isPlainObject(entry) && typeof entry.verdict === 'string' ? entry.verdict : ''
    const verdict = isAgentMemorySuggestionVerdict(rawVerdict)
      ? rawVerdict
      : AUDIT_VERDICT_ALIASES[rawVerdict]
    if (!isPlainObject(entry) || reference === null || !verdict) {
      result.invalid.push(reference ?? JSON.stringify(entry).slice(0, 80))
      continue
    }
    const item = findItem(listing, reference)
    if (!item) {
      result.unmatched.push(reference)
      continue
    }
    const reason = typeof entry.reason === 'string' ? entry.reason : ''
    const target = typeof entry.mergeTarget === 'string' ? entry.mergeTarget : undefined
    pending.push({
      item,
      suggestion: {
        verdict,
        reason: (verdict === rawVerdict ? reason : `${rawVerdict}: ${reason}`).slice(
          0,
          SUGGESTION_REASON_MAX_LENGTH
        ),
        by,
        at: now.toISOString(),
        ...(target ? { mergeTarget: mergeTargetId(listing, target) } : {})
      }
    })
    result.applied.push(item.id)
  }
  await writeSuggestions(pending)
  return result
}
