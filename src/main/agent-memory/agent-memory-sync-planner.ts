import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AgentMemorySyncPlan,
  AgentMemorySyncTargetPlan
} from '../../shared/agent-memory/agent-memory-sync-types'
import type {
  AgentMemoryAdapterEnvironment,
  AgentMemoryAgentAdapter,
  AgentMemoryLinks
} from './agent-memory-agent-adapter'
import { readTextFileOrNull } from './agent-memory-file-io'
import { findManagedBlock, writeManagedBlock } from './agent-memory-managed-block'
import {
  readRenderedManifest,
  type AgentMemoryRenderedManifestEntry
} from './agent-memory-rendered-files'

export type AgentMemorySyncPlanInput = {
  storeRootDirectory: string
  /** Planned manifest when previewing a decision; read from disk otherwise. */
  manifest?: readonly AgentMemoryRenderedManifestEntry[]
  adapters: readonly AgentMemoryAgentAdapter[]
  environment: AgentMemoryAdapterEnvironment
  /** Reads through a pending change batch; disk by default. */
  readText?: (path: string) => Promise<string | null>
}

export function fingerprintFileText(text: string | null): string {
  return text === null ? 'absent' : createHash('sha256').update(text).digest('hex')
}

/** Git prints the physical path, so resolve symlinks (e.g. /tmp → /private/tmp) in the repo path. */
async function gitCommonDirectoryOf(repoPath: string): Promise<string> {
  const physical = await realpath(repoPath).catch(() => repoPath)
  return join(physical, '.git')
}

async function linksForAgent(
  manifest: readonly AgentMemoryRenderedManifestEntry[],
  agent: AgentMemoryAgentAdapter['agent']
): Promise<AgentMemoryLinks> {
  const links: AgentMemoryLinks = { globalPath: null, repos: [] }
  for (const entry of manifest) {
    if (!entry.agents.includes(agent)) {
      continue
    }
    if (entry.scope.kind === 'global') {
      links.globalPath = entry.path
    } else {
      links.repos.push({
        repoPath: entry.scope.repoPath,
        gitCommonDirectory: await gitCommonDirectoryOf(entry.scope.repoPath),
        renderedPath: entry.path
      })
    }
  }
  links.repos.sort((left, right) => left.repoPath.localeCompare(right.repoPath))
  return links
}

function planBlock(
  current: string | null,
  inner: string | null
): Pick<AgentMemorySyncTargetPlan, 'status' | 'nextFileText'> | null {
  if (current === null) {
    return inner === null
      ? null
      : { status: 'create', nextFileText: writeManagedBlock('', inner, 'end') }
  }
  const lookup = findManagedBlock(current)
  if (lookup.kind === 'malformed') {
    return { status: 'drifted', nextFileText: current }
  }
  if (lookup.kind === 'absent' && inner === null) {
    return null
  }
  const nextFileText = writeManagedBlock(current, inner, 'end')
  if (lookup.kind === 'present' && !lookup.intact) {
    return { status: 'drifted', nextFileText }
  }
  return { status: nextFileText === current ? 'in-sync' : 'update', nextFileText }
}

/** Reads only; computes each agent's link block from the rendered-file manifest. */
export async function planAgentMemorySync(
  input: AgentMemorySyncPlanInput
): Promise<AgentMemorySyncPlan> {
  const manifest = input.manifest ?? (await readRenderedManifest(input.storeRootDirectory))
  const targets: AgentMemorySyncTargetPlan[] = []
  for (const adapter of input.adapters) {
    const links = await linksForAgent(manifest, adapter.agent)
    const hasLinks = links.globalPath !== null || links.repos.length > 0
    const { path, warnings } = await adapter.describeInstructionFile(input.environment)
    const current = await (input.readText ?? readTextFileOrNull)(path)
    const planned = planBlock(current, hasLinks ? adapter.renderLinkBlock(links) : null)
    if (!planned) {
      continue
    }
    targets.push({
      agent: adapter.agent,
      path,
      currentFileText: current,
      currentFileFingerprint: fingerprintFileText(current),
      linkedScopes: [
        ...(links.globalPath ? [{ kind: 'global' as const }] : []),
        ...links.repos.map((repo) => ({ kind: 'repo' as const, repoPath: repo.repoPath }))
      ],
      warnings,
      ...planned
    })
  }
  return {
    targets,
    renderedFiles: manifest.map(({ agents: _agents, ...file }) => file)
  }
}
