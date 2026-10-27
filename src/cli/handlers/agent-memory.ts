import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { RuntimeClientError } from '../runtime-client'
import { getDefaultUserDataPath } from '../runtime/metadata'
import { getOptionalStringFlag, getRepeatedStringFlag, getRequiredStringFlag } from '../flags'
import { writeStdoutLine } from '../stdout-line'
import {
  formatAgentMemoryApplyResult,
  formatAgentMemoryDecisionPreview,
  formatAgentMemoryHistory,
  formatAgentMemoryItem,
  formatAgentMemoryList,
  formatAgentMemorySyncPlan
} from '../agent-memory-format'
import type { AgentMemoryScopeRequest } from '../../shared/agent-memory/agent-memory-review-types'
import {
  AGENT_MEMORY_AGENTS,
  AGENT_MEMORY_DECISIONS,
  AGENT_MEMORY_SUGGESTION_VERDICTS,
  isAgentMemoryAgent,
  isAgentMemoryDecision,
  isAgentMemorySuggestionVerdict
} from '../../shared/agent-memory/agent-memory-types'
import {
  AgentMemoryService,
  resolveAgentMemoryStoreRoot,
  resolveMainCheckoutPath
} from '../../main/agent-memory/agent-memory-cli-entry'

function createService(): AgentMemoryService {
  return new AgentMemoryService({
    storeRootDirectory: resolveAgentMemoryStoreRoot(getDefaultUserDataPath()),
    environment: { homeDirectory: homedir(), processEnvironment: process.env }
  })
}

function print(ctx: HandlerContext, value: unknown, text: string): void {
  writeStdoutLine(ctx.json ? JSON.stringify(value, null, 2) : text)
}

function invalid(message: string): RuntimeClientError {
  return new RuntimeClientError('invalid_argument', message)
}

/** --global, --workspace [<path>], or the repo (else folder) containing the current directory. */
async function resolveScope(ctx: HandlerContext): Promise<AgentMemoryScopeRequest> {
  const workspaceFlag = ctx.flags.get('workspace')
  if (ctx.flags.get('global') === true) {
    if (workspaceFlag !== undefined) {
      throw invalid('Use either --global or --workspace')
    }
    return { kind: 'global' }
  }
  const start = resolve(ctx.cwd, typeof workspaceFlag === 'string' ? workspaceFlag : '.')
  // Folder workspaces have no git; Claude keys their memory by the folder path itself.
  return { kind: 'workspace', repoPath: (await resolveMainCheckoutPath(start)) ?? start }
}

async function readBodyFlags(ctx: HandlerContext): Promise<string | undefined> {
  const body = getOptionalStringFlag(ctx.flags, 'body')
  const bodyFile = getOptionalStringFlag(ctx.flags, 'body-file')
  if (body !== undefined && bodyFile !== undefined) {
    throw invalid('Use either --body or --body-file, not both')
  }
  return bodyFile === undefined ? body : readFile(resolve(ctx.cwd, bodyFile), 'utf8')
}

const listHandler: CommandHandler = async (ctx) => {
  const listing = await createService().list(await resolveScope(ctx))
  const type = getOptionalStringFlag(ctx.flags, 'type')
  const unreviewedOnly = ctx.flags.get('unreviewed') === true
  const items = listing.items.filter(
    (item) =>
      (!type || item.type === type) && (!unreviewedOnly || item.unreviewedReasons.length > 0)
  )
  print(ctx, { ...listing, items }, formatAgentMemoryList(listing, items))
}

const showHandler: CommandHandler = async (ctx) => {
  const item = await createService().show(
    await resolveScope(ctx),
    getRequiredStringFlag(ctx.flags, 'id')
  )
  print(ctx, item, formatAgentMemoryItem(item))
}

const historyHandler: CommandHandler = async (ctx) => {
  const entries = await createService().history(
    await resolveScope(ctx),
    getRequiredStringFlag(ctx.flags, 'id')
  )
  print(ctx, { history: entries }, formatAgentMemoryHistory(entries))
}

const suggestHandler: CommandHandler = async (ctx) => {
  const service = createService()
  const scope = await resolveScope(ctx)
  const by = getOptionalStringFlag(ctx.flags, 'by') ?? 'agent'
  const fromJson = getOptionalStringFlag(ctx.flags, 'from-json')
  if (fromJson !== undefined) {
    const result = await service.suggestFromAudit(
      scope,
      await readFile(resolve(ctx.cwd, fromJson), 'utf8'),
      by
    )
    print(
      ctx,
      result,
      `Suggested ${result.applied.length}; unmatched ${result.unmatched.length}${result.unmatched.length ? ` (${result.unmatched.join(', ')})` : ''}; invalid ${result.invalid.length}.`
    )
    return
  }
  const verdict = getRequiredStringFlag(ctx.flags, 'verdict').toUpperCase()
  if (!isAgentMemorySuggestionVerdict(verdict)) {
    throw invalid(`--verdict must be one of ${AGENT_MEMORY_SUGGESTION_VERDICTS.join(', ')}`)
  }
  const item = await service.suggest({
    scope,
    itemId: getRequiredStringFlag(ctx.flags, 'id'),
    verdict,
    reason: getRequiredStringFlag(ctx.flags, 'reason'),
    by,
    mergeTargetId: getOptionalStringFlag(ctx.flags, 'merge-target')
  })
  print(
    ctx,
    { id: item.id, verdict },
    `Suggested ${verdict} for ${item.id}. The user decides in Orca.`
  )
}

const addHandler: CommandHandler = async (ctx) => {
  const id = await createService().add(await resolveScope(ctx), {
    name: getRequiredStringFlag(ctx.flags, 'name'),
    type: getRequiredStringFlag(ctx.flags, 'type'),
    description: getOptionalStringFlag(ctx.flags, 'description') ?? '',
    body: (await readBodyFlags(ctx)) ?? ''
  })
  print(ctx, { id }, `Added ${id}; it is unreviewed until the user reviews it in Orca.`)
}

const editHandler: CommandHandler = async (ctx) => {
  const text = await readBodyFlags(ctx)
  if (text === undefined) {
    throw invalid('edit needs --body or --body-file')
  }
  const item = await createService().editText(
    await resolveScope(ctx),
    getRequiredStringFlag(ctx.flags, 'id'),
    text
  )
  print(
    ctx,
    { id: item.id },
    `Updated ${item.id}; it is unreviewed until the user reviews it in Orca.`
  )
}

function parseShareFlag(ctx: HandlerContext): string[] | undefined {
  const value = getOptionalStringFlag(ctx.flags, 'share')
  if (value === undefined) {
    return undefined
  }
  const agents = value
    .split(',')
    .map((agent) => agent.trim())
    .filter(Boolean)
  const unknown = agents.filter((agent) => !isAgentMemoryAgent(agent))
  if (unknown.length > 0) {
    throw invalid(`Unknown agent ${unknown.join(', ')}; use ${AGENT_MEMORY_AGENTS.join(', ')}`)
  }
  return agents
}

const reviewHandler: CommandHandler = async (ctx) => {
  const decision = getRequiredStringFlag(ctx.flags, 'decision').toUpperCase()
  if (!isAgentMemoryDecision(decision)) {
    throw invalid(`--decision must be one of ${AGENT_MEMORY_DECISIONS.join(', ')}`)
  }
  const service = createService()
  const scope = await resolveScope(ctx)
  const item = await service.show(scope, getRequiredStringFlag(ctx.flags, 'id'))
  const bodyFile = getOptionalStringFlag(ctx.flags, 'body-file')
  const request = {
    scope,
    itemId: item.id,
    contentHash: item.contentHash,
    decision,
    shares: (parseShareFlag(ctx) ?? []).filter(isAgentMemoryAgent),
    mergeTargetId: getOptionalStringFlag(ctx.flags, 'merge-target'),
    ...(bodyFile ? { editedText: await readFile(resolve(ctx.cwd, bodyFile), 'utf8') } : {})
  }
  const preview = await service.previewDecisions([request])
  if (ctx.flags.get('yes') !== true || preview.requests.length === 0) {
    print(
      ctx,
      preview,
      `${formatAgentMemoryDecisionPreview(preview)}\nNothing written; re-run with --yes to apply.`
    )
    return
  }
  const result = await service.applyDecisions({
    requests: preview.requests,
    previewFingerprint: preview.previewFingerprint
  })
  print(
    ctx,
    result,
    `${formatAgentMemoryDecisionPreview(preview)}\nApplied.${result.undoId ? ` Undo with: orca agent-memory undo ${result.undoId}` : ''}`
  )
}

const undoHandler: CommandHandler = async (ctx) => {
  const result = await createService().undo(getRequiredStringFlag(ctx.flags, 'undo-id'))
  print(
    ctx,
    result,
    `Restored ${result.restoredFiles.length} file(s) and ${result.restoredRecords.length} review record(s).`
  )
}

const syncHandler: CommandHandler = async (ctx) => {
  const service = createService()
  if (ctx.flags.get('dry-run') === true) {
    const plan = await service.planSync()
    print(ctx, plan, formatAgentMemorySyncPlan(plan))
    return
  }
  const overwriteDriftedPaths = getRepeatedStringFlag(ctx.flags, 'overwrite-drifted').map((path) =>
    resolve(ctx.cwd, path)
  )
  const result = await service.applySync({ overwriteDriftedPaths })
  print(ctx, result, formatAgentMemoryApplyResult(result))
}

export const AGENT_MEMORY_HANDLERS: Record<string, CommandHandler> = {
  'agent-memory list': listHandler,
  'agent-memory show': showHandler,
  'agent-memory history': historyHandler,
  'agent-memory suggest': suggestHandler,
  'agent-memory add': addHandler,
  'agent-memory edit': editHandler,
  'agent-memory review': reviewHandler,
  'agent-memory undo': undoHandler,
  'agent-memory sync': syncHandler
}
