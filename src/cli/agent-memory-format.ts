import type {
  AgentMemoryDecisionPreview,
  AgentMemoryFileChange,
  AgentMemoryListing
} from '../shared/agent-memory/agent-memory-review-types'
import type {
  AgentMemoryApplyResult,
  AgentMemorySyncPlan
} from '../shared/agent-memory/agent-memory-sync-types'
import type {
  AgentMemoryHistoryEntry,
  AgentMemoryItem
} from '../shared/agent-memory/agent-memory-types'

function reviewLabel(item: AgentMemoryItem): string {
  return item.unreviewedReasons.length > 0
    ? `unreviewed: ${item.unreviewedReasons.join(', ')}`
    : `reviewed ${item.record?.decision ?? ''}`.trim()
}

export function formatAgentMemoryList(
  listing: AgentMemoryListing,
  items: AgentMemoryItem[]
): string {
  const header = `${items.length} memories (${listing.unreviewedCount} unreviewed in scope)${listing.baseRef ? `; in-repo files from ${listing.baseRef}` : ''}`
  const lines = items.map((item) => {
    const seen = item.locations.length > 1 ? ` seen in ${item.locations.length}` : ''
    const suggestion = item.record?.suggestion ? ` suggest ${item.record.suggestion.verdict}` : ''
    return `${item.id}  [${item.type}/${item.nativeAgent}] ${item.title} (${reviewLabel(item)}${suggestion}${seen})`
  })
  return [header, ...lines, ...listing.warnings.map((warning) => `warning: ${warning}`)].join('\n')
}

export function formatAgentMemoryItem(item: AgentMemoryItem): string {
  const record = item.record
  return [
    `${item.title} (${item.id})`,
    `type: ${item.type}   agent: ${item.nativeAgent}   ${reviewLabel(item)}`,
    `files: ${item.locations.map((location) => location.path).join(', ')}`,
    ...(record?.shares.length ? [`shared with: ${record.shares.join(', ')}`] : []),
    ...(record?.suggestion
      ? [
          `suggestion: ${record.suggestion.verdict} by ${record.suggestion.by}: ${record.suggestion.reason}`
        ]
      : []),
    ...item.staleFindings.map((finding) => `stale: ${finding.detail}`),
    '',
    item.text
  ].join('\n')
}

export function formatAgentMemoryHistory(entries: AgentMemoryHistoryEntry[]): string {
  if (entries.length === 0) {
    return 'No review history.'
  }
  return entries
    .map((entry) => {
      const detail = entry.decision ?? entry.verdict ?? ''
      const by = entry.by ? ` by ${entry.by}` : ''
      const shares = entry.shares?.length ? ` shares=${entry.shares.join(',')}` : ''
      return `${entry.at}  ${entry.event} ${detail}${by}${shares}`.trimEnd()
    })
    .join('\n')
}

function formatChange(change: AgentMemoryFileChange): string {
  const target = change.kind === 'move' ? `${change.path} -> ${change.toPath}` : change.path
  return `${change.kind.padEnd(6)} ${change.owner.padEnd(16)} ${target}`
}

export function formatAgentMemoryDecisionPreview(preview: AgentMemoryDecisionPreview): string {
  return [
    ...preview.requests.map((request) => `decide ${request.decision} ${request.itemId}`),
    ...(preview.fileChanges.length > 0
      ? preview.fileChanges.map(formatChange)
      : ['No file changes; only the review record is written.']),
    ...preview.rejected.map((rejection) => `rejected ${rejection.itemId}: ${rejection.reason}`),
    ...preview.warnings.map((warning) => `warning: ${warning}`)
  ].join('\n')
}

export function formatAgentMemorySyncPlan(plan: AgentMemorySyncPlan): string {
  const rendered = plan.renderedFiles.map(
    (file) =>
      `${'rendered'.padEnd(17)} ${file.path} (${file.memoryCount} memories, ~${file.approximateTokens} tokens)`
  )
  const targets = plan.targets.map((target) => {
    const warnings = target.warnings.length > 0 ? `  warning: ${target.warnings.join(', ')}` : ''
    return `${target.status.padEnd(17)} ${target.agent.padEnd(6)} ${target.path}${warnings}`
  })
  return [...rendered, ...targets].join('\n') || 'Nothing shared, nothing to link.'
}

export function formatAgentMemoryApplyResult(result: AgentMemoryApplyResult): string {
  if (result.targets.length === 0) {
    return 'Nothing to sync.'
  }
  return result.targets
    .map((target) => `${target.outcome.padEnd(26)} ${target.agent.padEnd(6)} ${target.path}`)
    .join('\n')
}
