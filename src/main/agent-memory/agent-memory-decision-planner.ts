import { basename } from 'node:path'
import { validateAgentMemoryBody } from '../../shared/agent-memory/agent-memory-draft-validation'
import type {
  AgentMemoryDecisionRequest,
  AgentMemoryListing
} from '../../shared/agent-memory/agent-memory-review-types'
import type {
  AgentMemoryAgent,
  AgentMemoryItem,
  AgentMemoryReviewRecord
} from '../../shared/agent-memory/agent-memory-types'
import { agentMemoryEntryHash } from './agent-memory-catalog'
import { parseClaudeMemoryFile } from './agent-memory-claude-project-memory-reader'
import {
  AgentMemoryFileChangeConflict,
  type AgentMemoryFileChangeBatch
} from './agent-memory-file-change-batch'
import { firstProseLine } from './agent-memory-instruction-section-readers'
import { splitMarkdownSections } from './agent-memory-markdown-sections'
import {
  isUserInstructionSection,
  planClaudeMemoryRemoval,
  planInstructionSectionArchive,
  planMemoryTextEdit
} from './agent-memory-native-file-changes'
import { emptyReviewRecord } from './agent-memory-review-file'

/** A decision with the record it writes; the file changes went into the shared batch. */
export type AgentMemoryPlannedDecision = {
  request: AgentMemoryDecisionRequest
  item: AgentMemoryItem
  /** Record key; differs from `item.id` only when an EDIT renamed a section heading. */
  recordId: string
  record: AgentMemoryReviewRecord
  /** Texts that EDIT/MERGE change, by item id, so sharing renders what the files will hold. */
  textUpdates: { itemId: string; text: string }[]
}

export const REMOVING_DECISIONS = new Set(['ARCHIVE', 'DELETE', 'MERGE'])

/** Hash and id the source will have after an edit, so the record stays reviewed. */
async function identityAfterEdit(
  batch: AgentMemoryFileChangeBatch,
  item: AgentMemoryItem,
  nextText: string
): Promise<{ id: string; contentHash: string }> {
  const path = item.locations[0].path
  const fileText = (await batch.read(path)) ?? ''
  if (item.sectionHeading === null) {
    return {
      id: item.id,
      contentHash: agentMemoryEntryHash(parseClaudeMemoryFile(basename(path), fileText))
    }
  }
  const section = splitMarkdownSections(fileText).find(
    (candidate) => candidate.text === nextText.trimEnd()
  )
  if (!section) {
    return { id: item.id, contentHash: '' }
  }
  const prefix = item.id.slice(0, item.id.lastIndexOf('#'))
  return {
    id: `${prefix}#${section.key}`,
    contentHash: agentMemoryEntryHash({
      title: section.heading ?? section.key,
      description: firstProseLine(section.text),
      type: 'instruction',
      text: section.text
    })
  }
}

function sharesFor(
  request: AgentMemoryDecisionRequest,
  item: AgentMemoryItem,
  listing: AgentMemoryListing
): AgentMemoryAgent[] {
  if (request.decision === 'SHARE') {
    return [...new Set(request.shares ?? [])].filter(
      (agent) => agent !== item.nativeAgent && listing.linkableAgents.includes(agent)
    )
  }
  return request.decision === 'EDIT' ? (item.record?.shares ?? []) : []
}

async function planFileChanges(
  batch: AgentMemoryFileChangeBatch,
  request: AgentMemoryDecisionRequest,
  item: AgentMemoryItem,
  listing: AgentMemoryListing
): Promise<{ nextText: string | null; mergeTarget: AgentMemoryItem | null }> {
  switch (request.decision) {
    case 'KEEP':
    case 'SHARE':
      return { nextText: null, mergeTarget: null }
    case 'EDIT': {
      const text = request.editedText?.trim() ?? ''
      const problem = !item.editable
        ? 'this source is read from main; edit it in a branch'
        : validateAgentMemoryBody(text)
      if (problem || text.length === 0) {
        throw new AgentMemoryFileChangeConflict(problem ?? 'edited text is empty')
      }
      await planMemoryTextEdit(batch, item, text)
      return { nextText: text, mergeTarget: null }
    }
    case 'ARCHIVE':
      // In-repo sections are read from main, so their ARCHIVE is a review record only.
      if (item.nativeArchive) {
        await planClaudeMemoryRemoval(batch, item, 'archive')
      } else if (isUserInstructionSection(item)) {
        await planInstructionSectionArchive(batch, item)
      }
      return { nextText: null, mergeTarget: null }
    case 'DELETE':
      if (item.nativeArchive) {
        await planClaudeMemoryRemoval(batch, item, 'delete')
      } else if (item.editable) {
        await planMemoryTextEdit(batch, item, '')
      } else {
        throw new AgentMemoryFileChangeConflict(
          'this source is read from main; delete it in a branch'
        )
      }
      return { nextText: null, mergeTarget: null }
    case 'MERGE': {
      const target = listing.items.find((candidate) => candidate.id === request.mergeTargetId)
      if (!target || target.id === item.id || !target.editable) {
        throw new AgentMemoryFileChangeConflict('merge needs another editable memory as the target')
      }
      const merged = `${target.text.trimEnd()}\n\n${item.text.trim()}`
      await planMemoryTextEdit(batch, target, merged)
      if (item.nativeArchive) {
        await planClaudeMemoryRemoval(batch, item, 'archive')
      }
      return { nextText: merged, mergeTarget: target }
    }
  }
}

/** Plans one decision into `batch`; throws AgentMemoryFileChangeConflict when it cannot apply. */
export async function planAgentMemoryDecision(
  batch: AgentMemoryFileChangeBatch,
  request: AgentMemoryDecisionRequest,
  listing: AgentMemoryListing,
  now: Date
): Promise<AgentMemoryPlannedDecision> {
  const item = listing.items.find((candidate) => candidate.id === request.itemId)
  if (!item) {
    throw new AgentMemoryFileChangeConflict('memory not found; refresh the list')
  }
  if (item.contentHash !== request.contentHash) {
    throw new AgentMemoryFileChangeConflict('memory changed since it was shown; review it again')
  }
  const { nextText, mergeTarget } = await planFileChanges(batch, request, item, listing)
  const identity =
    request.decision === 'EDIT' && nextText !== null
      ? await identityAfterEdit(batch, item, nextText)
      : { id: item.id, contentHash: item.contentHash }
  const base = item.record ?? emptyReviewRecord(item.contentHash)
  const shares = sharesFor(request, item, listing)
  const keepsSource = !REMOVING_DECISIONS.has(request.decision)
  const at = now.toISOString()
  const record: AgentMemoryReviewRecord = {
    ...base,
    contentHash: identity.contentHash,
    reviewedAt: at,
    decision: request.decision,
    shares,
    ...(request.decision === 'MERGE' && request.mergeTargetId
      ? { mergeTarget: request.mergeTargetId }
      : {}),
    // Keeping a memory accepts the stale findings shown with it.
    acknowledgedStaleness: keepsSource
      ? [
          ...new Set([
            ...base.acknowledgedStaleness,
            ...item.staleFindings.map((finding) => finding.key)
          ])
        ]
      : base.acknowledgedStaleness,
    ...(keepsSource
      ? {}
      : {
          sourceGone:
            item.nativeArchive || isUserInstructionSection(item) || request.decision === 'DELETE'
        }),
    history: [
      ...base.history,
      {
        at,
        event: 'DECIDED',
        contentHash: identity.contentHash,
        decision: request.decision,
        shares
      }
    ]
  }
  return {
    request,
    item,
    recordId: identity.id,
    record,
    textUpdates: nextText === null ? [] : [{ itemId: mergeTarget?.id ?? item.id, text: nextText }]
  }
}
