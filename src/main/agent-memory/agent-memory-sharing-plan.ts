import type { AgentMemoryListing } from '../../shared/agent-memory/agent-memory-review-types'
import type { AgentMemoryRenderedScope } from '../../shared/agent-memory/agent-memory-sync-types'
import { agentMemoryLinkAdapters } from './agent-memory-adapter-registry'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import {
  REMOVING_DECISIONS,
  type AgentMemoryPlannedDecision
} from './agent-memory-decision-planner'
import type { AgentMemoryFileChangeBatch } from './agent-memory-file-change-batch'
import { readTextFileOrNull, writeTextFileAtomically } from './agent-memory-file-io'
import {
  agentMemoryRenderedPath,
  planRenderedScope,
  readRenderedManifest,
  renderAgentMemoryScopeFile,
  writeRenderedManifest,
  type AgentMemorySharedEntry
} from './agent-memory-rendered-files'
import { planAgentMemorySync } from './agent-memory-sync-planner'

export function renderedScopeOf(listing: AgentMemoryListing): AgentMemoryRenderedScope {
  return listing.scope.kind === 'global'
    ? { kind: 'global' }
    : { kind: 'repo', repoPath: listing.scope.repoPath }
}

/** Memories with live shares after `planned` applies, with the text the files will then hold. */
export function sharedEntriesAfter(
  listing: AgentMemoryListing,
  planned: readonly AgentMemoryPlannedDecision[]
): AgentMemorySharedEntry[] {
  const recordById = new Map(planned.map((decision) => [decision.item.id, decision.record]))
  const textById = new Map(
    planned
      .flatMap((decision) => decision.textUpdates)
      .map((update) => [update.itemId, update.text])
  )
  return listing.items.flatMap((item) => {
    const planned = recordById.get(item.id)
    const record = planned ?? item.record
    // Changed since its SHARE review: paused until the user reviews it again.
    const paused = !planned && record?.contentHash !== item.contentHash
    if (
      !record ||
      paused ||
      record.sourceGone ||
      (record.decision && REMOVING_DECISIONS.has(record.decision))
    ) {
      return []
    }
    const agents = record.shares.filter((agent) => agent !== item.nativeAgent)
    if (agents.length === 0) {
      return []
    }
    return [
      {
        title: item.title,
        // A section's text already starts with its heading.
        description: item.sectionHeading === null ? item.description : '',
        text: textById.get(item.id) ?? item.text,
        agents
      }
    ]
  })
}

/**
 * Re-renders the scope's shared file and each agent's link block into `batch`. A block someone
 * edited by hand is left alone and reported, never overwritten.
 */
export async function planSharingForScope(
  batch: AgentMemoryFileChangeBatch,
  options: {
    storeRootDirectory: string
    environment: AgentMemoryAdapterEnvironment
    listing: AgentMemoryListing
    planned: readonly AgentMemoryPlannedDecision[]
  }
): Promise<string[]> {
  const manifest = await planRenderedScope(
    batch,
    options.storeRootDirectory,
    renderedScopeOf(options.listing),
    sharedEntriesAfter(options.listing, options.planned)
  )
  const plan = await planAgentMemorySync({
    storeRootDirectory: options.storeRootDirectory,
    manifest,
    adapters: agentMemoryLinkAdapters(),
    environment: options.environment,
    readText: (path) => batch.read(path)
  })
  const warnings: string[] = []
  for (const target of plan.targets) {
    if (target.status === 'create' || target.status === 'update') {
      await batch.write(target.path, target.nextFileText, 'agent-link-block')
    } else if (target.status === 'drifted') {
      warnings.push(
        `${target.path}: Orca's block was edited outside Orca and is left unchanged; run \`orca agent-memory sync --overwrite-drifted ${target.path}\` to replace it.`
      )
    }
    if (target.warnings.includes('codex-override-shadows-agents-md')) {
      warnings.push(`${target.path}: AGENTS.override.md exists, so Codex ignores AGENTS.md.`)
    }
  }
  return warnings
}

/**
 * Re-renders a scope's linked file when a shared memory changed outside Orca, so paused shares
 * leave it without a decision. Only the Orca-owned file changes; an emptied file is kept so links
 * stay valid.
 */
export async function refreshRenderedScopeForPausedShares(
  storeRootDirectory: string,
  listing: AgentMemoryListing
): Promise<void> {
  const scope = renderedScopeOf(listing)
  const path = agentMemoryRenderedPath(storeRootDirectory, scope)
  const manifest = await readRenderedManifest(storeRootDirectory)
  const entry = manifest.find((candidate) => candidate.path === path)
  if (!entry) {
    return
  }
  const text = renderAgentMemoryScopeFile(scope, sharedEntriesAfter(listing, []))
  if ((await readTextFileOrNull(path)) === text) {
    return
  }
  await writeTextFileAtomically(path, text)
  await writeRenderedManifest(
    storeRootDirectory,
    manifest.map((candidate) =>
      candidate === entry
        ? {
            ...candidate,
            memoryCount: sharedEntriesAfter(listing, []).length,
            approximateTokens: Math.ceil(text.length / 4)
          }
        : candidate
    )
  )
}
