import { createHash } from 'node:crypto'
import type {
  AgentMemoryAgent,
  AgentMemoryItem,
  AgentMemoryReviewRecord,
  AgentMemoryScopeKind,
  AgentMemoryShareState,
  AgentMemoryStaleFinding,
  AgentMemoryUnreviewedReason
} from '../../shared/agent-memory/agent-memory-types'
import {
  readReviewRecords,
  updateReviewRecords,
  type AgentMemoryReviewRecords
} from './agent-memory-review-file'
import type { AgentMemorySourceEntry } from './agent-memory-source-reader'
import type { AgentMemoryStalenessDependencies } from './agent-memory-staleness'
import { findStaleFindings } from './agent-memory-staleness'

const DAY_MS = 24 * 60 * 60 * 1000

export type AgentMemoryCatalogOptions = {
  scope: AgentMemoryScopeKind
  linkableAgents: readonly AgentMemoryAgent[]
  staleness: AgentMemoryStalenessDependencies
  /** Re-review project memories after this many days; null keeps reviews forever (default). */
  projectReviewExpiryDays: number | null
  now: Date
}

/** Covers everything an agent reader shows, so a metadata edit also counts as a change. */
export function agentMemoryEntryHash(
  entry: Pick<AgentMemorySourceEntry, 'title' | 'description' | 'type' | 'text'>
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        entry.title,
        entry.description,
        entry.type,
        entry.text.replace(/\r\n/g, '\n')
      ])
    )
    .digest('hex')
}

type EntryGroup = { hash: string; entries: AgentMemorySourceEntry[] }

/** One item per distinct content: copies in several worktrees collapse into one card. */
function groupByContent(entries: readonly AgentMemorySourceEntry[]): EntryGroup[] {
  const groups = new Map<string, EntryGroup>()
  for (const entry of entries) {
    const hash = agentMemoryEntryHash(entry)
    const group = groups.get(hash) ?? { hash, entries: [] }
    group.entries.push(entry)
    groups.set(hash, group)
  }
  for (const group of groups.values()) {
    // Main checkout first: its directory holds the canonical review record.
    group.entries.sort((a, b) => Number(a.worktreePath !== null) - Number(b.worktreePath !== null))
  }
  return [...groups.values()]
}

type FoundRecord = { record: AgentMemoryReviewRecord; carriedFromId: string | null; path: string }

function findRecord(
  id: string,
  hash: string,
  presentIds: ReadonlySet<string>,
  recordFiles: readonly { path: string; records: AgentMemoryReviewRecords }[]
): FoundRecord | null {
  for (const { path, records } of recordFiles) {
    if (records[id]) {
      return { record: records[id], carriedFromId: null, path }
    }
  }
  // Renamed source: carry over the record of a vanished id with the same content; archived ones stay put.
  for (const { path, records } of recordFiles) {
    const carried = Object.entries(records).find(
      ([recordId, record]) =>
        !presentIds.has(recordId) && !record.sourceGone && record.contentHash === hash
    )
    if (carried) {
      return { record: carried[1], carriedFromId: carried[0], path }
    }
  }
  return null
}

/** Moves carried records to their new id, so a later edit of the renamed file keeps its history. */
async function persistRenames(
  renames: readonly {
    path: string
    fromId: string
    toId: string
    record: AgentMemoryReviewRecord
  }[],
  now: Date
): Promise<void> {
  for (const [path, group] of Map.groupBy(renames, (rename) => rename.path)) {
    await updateReviewRecords(path, (records) => {
      for (const rename of group) {
        delete records[rename.fromId]
        records[rename.toId] = {
          ...rename.record,
          history: [
            ...rename.record.history,
            {
              at: now.toISOString(),
              event: 'RENAMED',
              contentHash: rename.record.contentHash,
              note: rename.fromId
            }
          ]
        }
      }
    })
  }
}

function shareStates(
  nativeAgent: AgentMemoryAgent,
  record: AgentMemoryReviewRecord | null,
  linkableAgents: readonly AgentMemoryAgent[],
  contentHash: string
): Record<AgentMemoryAgent, AgentMemoryShareState> {
  // A share covers the text the user reviewed; a later change pauses it until re-review.
  const shareLive = record?.contentHash === contentHash
  const stateFor = (agent: AgentMemoryAgent): AgentMemoryShareState =>
    agent === nativeAgent
      ? 'native'
      : !linkableAgents.includes(agent)
        ? 'unavailable'
        : record?.shares.includes(agent)
          ? shareLive
            ? 'shared'
            : 'paused'
          : 'not-shared'
  return {
    claude: stateFor('claude'),
    codex: stateFor('codex'),
    gemini: stateFor('gemini'),
    opencode: stateFor('opencode'),
    pi: stateFor('pi')
  }
}

async function unreviewedReasons(
  item: Pick<AgentMemoryItem, 'type' | 'text' | 'contentHash'>,
  record: AgentMemoryReviewRecord | null,
  options: AgentMemoryCatalogOptions
): Promise<{ reasons: AgentMemoryUnreviewedReason[]; findings: AgentMemoryStaleFinding[] }> {
  if (!record?.reviewedAt) {
    return { reasons: ['NO_RECORD'], findings: [] }
  }
  if (record.contentHash !== item.contentHash) {
    return { reasons: ['CONTENT_CHANGED'], findings: [] }
  }
  // Only reviewed memories pay for gh/git staleness checks.
  const findings = (await findStaleFindings(item.text, options.staleness)).filter(
    (finding) => !record.acknowledgedStaleness.includes(finding.key)
  )
  const reasons: AgentMemoryUnreviewedReason[] = findings.map((finding) => finding.reason)
  const expiry = options.projectReviewExpiryDays
  if (
    expiry !== null &&
    item.type === 'project' &&
    options.now.getTime() - Date.parse(record.reviewedAt) > expiry * DAY_MS
  ) {
    reasons.push('REVIEW_EXPIRED')
  }
  return { reasons: [...new Set(reasons)], findings }
}

export async function buildAgentMemoryItems(
  entries: readonly AgentMemorySourceEntry[],
  options: AgentMemoryCatalogOptions
): Promise<AgentMemoryItem[]> {
  const recordCache = new Map<string, AgentMemoryReviewRecords>()
  const recordsAt = async (path: string): Promise<AgentMemoryReviewRecords> => {
    const cached = recordCache.get(path) ?? (await readReviewRecords(path))
    recordCache.set(path, cached)
    return cached
  }
  const groups = groupByContent(entries)
  const presentIds = new Set(entries.map((entry) => entry.id))
  const usedIds = new Set<string>()
  const items: AgentMemoryItem[] = []
  const renames: Parameters<typeof persistRenames>[0][number][] = []
  for (const group of groups) {
    const canonical = group.entries[0]
    // Same file name, different content in two worktrees: the later variant gets a hash suffix.
    const id = usedIds.has(canonical.id)
      ? `${canonical.id}@${group.hash.slice(0, 8)}`
      : canonical.id
    usedIds.add(canonical.id)
    const reviewPaths = [...new Set(group.entries.map((entry) => entry.reviewFilePath))]
    const recordFiles = await Promise.all(
      reviewPaths.map(async (path) => ({ path, records: await recordsAt(path) }))
    )
    const found = findRecord(id, group.hash, presentIds, recordFiles)
    const record = found?.record ?? null
    if (found?.carriedFromId && found.path === canonical.reviewFilePath) {
      renames.push({
        path: found.path,
        fromId: found.carriedFromId,
        toId: id,
        record: found.record
      })
    }
    const base = {
      type: canonical.type,
      text: canonical.text,
      contentHash: group.hash
    }
    const { reasons, findings } = await unreviewedReasons(base, record, options)
    items.push({
      id,
      sourceKind: canonical.sourceKind,
      nativeAgent: canonical.nativeAgent,
      scope: options.scope,
      title: canonical.title,
      description: canonical.description,
      ...base,
      sizeBytes: Buffer.byteLength(canonical.text),
      modifiedAt:
        group.entries
          .map((entry) => entry.modifiedAt)
          .sort()
          .at(-1) ?? '',
      locations: group.entries.map((entry) => ({
        path: entry.path,
        worktreePath: entry.worktreePath
      })),
      sectionHeading: canonical.sectionKey,
      editable: canonical.editable,
      nativeArchive: canonical.nativeArchive,
      reviewFilePath: canonical.reviewFilePath,
      record,
      unreviewedReasons: reasons,
      staleFindings: findings,
      shareStates: shareStates(canonical.nativeAgent, record, options.linkableAgents, group.hash)
    })
  }
  if (renames.length > 0) {
    await persistRenames(renames, options.now)
  }
  return items.sort(
    (a, b) =>
      Number(b.unreviewedReasons.length > 0) - Number(a.unreviewedReasons.length > 0) ||
      a.title.localeCompare(b.title)
  )
}
