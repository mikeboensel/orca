import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { isPlainObject } from '../../shared/agent-memory/agent-memory-document-format'
import { readTextFileOrNull, writeTextFileAtomically } from './agent-memory-file-io'
import {
  AGENT_MEMORY_PR_STATES,
  type AgentMemoryPullRequestReference,
  type AgentMemoryPullRequestState
} from './agent-memory-staleness'

/** Merged and closed PRs rarely reopen; open ones are rechecked sooner. */
const OPEN_TTL_MS = 6 * 60 * 60 * 1000
const FINAL_TTL_MS = 7 * 24 * 60 * 60 * 1000
const GH_TIMEOUT_MS = 15_000

type CacheEntry = { state: AgentMemoryPullRequestState; checkedAt: number }

/** `gh pr view` results cached in Orca's agent-memory dir, shared by the app and the CLI. */
export class AgentMemoryPullRequestStateCache {
  private entries: Map<string, CacheEntry> | null = null

  constructor(
    private readonly cacheFilePath: string,
    private readonly now: () => number = Date.now
  ) {}

  static inStoreRoot(storeRootDirectory: string): AgentMemoryPullRequestStateCache {
    return new AgentMemoryPullRequestStateCache(join(storeRootDirectory, 'pr-state-cache.json'))
  }

  /** Null when gh is missing, signed out, or the PR is not found. */
  async getState(
    repoPath: string,
    reference: AgentMemoryPullRequestReference
  ): Promise<AgentMemoryPullRequestState | null> {
    const entries = await this.load()
    const key = `${reference.repository ?? repoPath}#${reference.number}`
    const cached = entries.get(key)
    if (cached) {
      const ttl = cached.state === 'OPEN' ? OPEN_TTL_MS : FINAL_TTL_MS
      if (this.now() - cached.checkedAt < ttl) {
        return cached.state
      }
    }
    const result = await runProcess({
      program: 'gh',
      args: [
        'pr',
        'view',
        String(reference.number),
        '--json',
        'state',
        ...(reference.repository ? ['--repo', reference.repository] : [])
      ],
      cwd: repoPath,
      timeoutMs: GH_TIMEOUT_MS
    }).catch(() => null)
    if (!result || result.code !== 0) {
      return null
    }
    let state: AgentMemoryPullRequestState | undefined
    try {
      const parsed: unknown = JSON.parse(result.stdout)
      state = AGENT_MEMORY_PR_STATES.find(
        (candidate) => isPlainObject(parsed) && candidate === parsed.state
      )
    } catch {
      return null
    }
    if (!state) {
      return null
    }
    entries.set(key, { state, checkedAt: this.now() })
    await writeTextFileAtomically(
      this.cacheFilePath,
      `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`
    )
    return state
  }

  private async load(): Promise<Map<string, CacheEntry>> {
    if (this.entries) {
      return this.entries
    }
    const entries = new Map<string, CacheEntry>()
    const text = await readTextFileOrNull(this.cacheFilePath)
    try {
      const parsed: unknown = text ? JSON.parse(text) : {}
      if (isPlainObject(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          const state = AGENT_MEMORY_PR_STATES.find(
            (candidate) => isPlainObject(value) && candidate === value.state
          )
          if (state && isPlainObject(value) && typeof value.checkedAt === 'number') {
            entries.set(key, { state, checkedAt: value.checkedAt })
          }
        }
      }
    } catch {
      // A corrupt cache only costs a refetch.
    }
    this.entries = entries
    return entries
  }
}
