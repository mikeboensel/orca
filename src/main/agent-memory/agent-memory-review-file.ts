import { isPlainObject } from '../../shared/agent-memory/agent-memory-document-format'
import {
  AGENT_MEMORY_HISTORY_EVENTS,
  isAgentMemoryAgent,
  isAgentMemoryDecision,
  isAgentMemorySuggestionVerdict,
  type AgentMemoryHistoryEntry,
  type AgentMemoryReviewRecord,
  type AgentMemorySuggestion
} from '../../shared/agent-memory/agent-memory-types'
import { readTextFileOrNull, writeTextFileAtomically } from './agent-memory-file-io'
import { withReviewFileLock } from './agent-memory-review-file-lock'

const REVIEW_FILE_VERSION = 1

export type AgentMemoryReviewRecords = Record<string, AgentMemoryReviewRecord>

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseSuggestion(value: unknown): AgentMemorySuggestion | undefined {
  if (!isPlainObject(value) || !isAgentMemorySuggestionVerdict(value.verdict)) {
    return undefined
  }
  return {
    verdict: value.verdict,
    reason: optionalString(value.reason) ?? '',
    by: optionalString(value.by) ?? 'unknown',
    at: optionalString(value.at) ?? '',
    ...(typeof value.mergeTarget === 'string' ? { mergeTarget: value.mergeTarget } : {})
  }
}

function parseHistoryEntry(value: unknown): AgentMemoryHistoryEntry | null {
  if (!isPlainObject(value)) {
    return null
  }
  const event = AGENT_MEMORY_HISTORY_EVENTS.find((candidate) => candidate === value.event)
  if (!event || typeof value.at !== 'string') {
    return null
  }
  return {
    at: value.at,
    event,
    contentHash: optionalString(value.contentHash) ?? '',
    ...(isAgentMemoryDecision(value.decision) ? { decision: value.decision } : {}),
    ...(Array.isArray(value.shares) ? { shares: value.shares.filter(isAgentMemoryAgent) } : {}),
    ...(isAgentMemorySuggestionVerdict(value.verdict) ? { verdict: value.verdict } : {}),
    ...(typeof value.by === 'string' ? { by: value.by } : {}),
    ...(typeof value.note === 'string' ? { note: value.note } : {})
  }
}

/** Untrusted JSON (hand edits, other versions) becomes a well-formed record or is dropped. */
export function parseReviewRecord(value: unknown): AgentMemoryReviewRecord | null {
  if (!isPlainObject(value) || typeof value.contentHash !== 'string') {
    return null
  }
  return {
    contentHash: value.contentHash,
    ...(typeof value.reviewedAt === 'string' ? { reviewedAt: value.reviewedAt } : {}),
    ...(isAgentMemoryDecision(value.decision) ? { decision: value.decision } : {}),
    shares: Array.isArray(value.shares) ? value.shares.filter(isAgentMemoryAgent) : [],
    ...(typeof value.mergeTarget === 'string' ? { mergeTarget: value.mergeTarget } : {}),
    ...(parseSuggestion(value.suggestion) ? { suggestion: parseSuggestion(value.suggestion) } : {}),
    acknowledgedStaleness: Array.isArray(value.acknowledgedStaleness)
      ? value.acknowledgedStaleness.filter((key) => typeof key === 'string')
      : [],
    ...(value.sourceGone === true ? { sourceGone: true } : {}),
    history: Array.isArray(value.history)
      ? value.history.flatMap((entry) => parseHistoryEntry(entry) ?? [])
      : []
  }
}

export function emptyReviewRecord(contentHash: string): AgentMemoryReviewRecord {
  return { contentHash, shares: [], acknowledgedStaleness: [], history: [] }
}

export async function readReviewRecords(path: string): Promise<AgentMemoryReviewRecords> {
  const text = await readTextFileOrNull(path)
  if (text === null) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {}
  }
  const records: AgentMemoryReviewRecords = {}
  if (isPlainObject(parsed) && isPlainObject(parsed.records)) {
    for (const [id, value] of Object.entries(parsed.records)) {
      const record = parseReviewRecord(value)
      if (record) {
        records[id] = record
      }
    }
  }
  return records
}

/**
 * Applies `mutate` to the records as they are on disk right now and writes atomically, under a
 * lock shared with other Orca processes, so no writer's records are lost.
 */
export async function updateReviewRecords(
  path: string,
  mutate: (records: AgentMemoryReviewRecords) => void
): Promise<AgentMemoryReviewRecords> {
  return withReviewFileLock(path, async () => {
    const records = await readReviewRecords(path)
    mutate(records)
    const sorted = Object.fromEntries(
      Object.entries(records).sort(([a], [b]) => a.localeCompare(b))
    )
    await writeTextFileAtomically(
      path,
      `${JSON.stringify({ version: REVIEW_FILE_VERSION, records: sorted }, null, 2)}\n`
    )
    return records
  })
}
