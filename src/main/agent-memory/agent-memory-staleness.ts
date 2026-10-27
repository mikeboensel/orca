import type { AgentMemoryStaleFinding } from '../../shared/agent-memory/agent-memory-types'

export type AgentMemoryPullRequestReference = {
  /** `owner/repo` when the memory names it (URL form); null means the workspace's own repo. */
  repository: string | null
  number: number
}

export const AGENT_MEMORY_PR_STATES = ['OPEN', 'MERGED', 'CLOSED'] as const
export type AgentMemoryPullRequestState = (typeof AGENT_MEMORY_PR_STATES)[number]

export type AgentMemoryStalenessDependencies = {
  /** Files on the base ref; null when the workspace has no git or base ref. */
  baseRefFiles: ReadonlySet<string> | null
  fetchPullRequestState: (
    reference: AgentMemoryPullRequestReference
  ) => Promise<AgentMemoryPullRequestState | null>
}

const PR_URL_PATTERN = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g
/** `PR #12` in prose; `repo-name PR #12` and `repo#12` name another repo, so they are skipped. */
const BARE_PR_PATTERN = /(?:^|[^\w-])(?<prefix>[\w-]+\s+)?PRs?\s+#(\d+)/gi
const PATH_PATTERN = /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]{1,8})(?=$|[\s`'"),:;])/g

export function extractPullRequestReferences(text: string): AgentMemoryPullRequestReference[] {
  const references = new Map<string, AgentMemoryPullRequestReference>()
  for (const match of text.matchAll(PR_URL_PATTERN)) {
    const reference = { repository: match[1], number: Number(match[2]) }
    references.set(`${reference.repository}#${reference.number}`, reference)
  }
  for (const match of text.matchAll(BARE_PR_PATTERN)) {
    const prefix = match.groups?.prefix?.trim() ?? ''
    if (prefix.includes('-')) {
      continue
    }
    const reference = { repository: null, number: Number(match[2]) }
    references.set(`#${reference.number}`, reference)
  }
  return [...references.values()]
}

/** Relative repo paths with an extension; absolute and home paths point outside the repo. */
export function extractRepoPathReferences(text: string): string[] {
  const paths = new Set<string>()
  for (const match of text.matchAll(PATH_PATTERN)) {
    const path = match[1].replace(/^\.\//, '')
    if (!path.startsWith('.') && !path.includes('://') && !/^\d/.test(path)) {
      paths.add(path)
    }
  }
  return [...paths]
}

function pullRequestKey(reference: AgentMemoryPullRequestReference): string {
  return `PR:${reference.repository ?? ''}#${reference.number}`
}

/**
 * A path is flagged only when its top-level folder exists on the base ref but the file does not,
 * so paths in other repos the memory mentions are not misread as deleted.
 */
export async function findStaleFindings(
  text: string,
  dependencies: AgentMemoryStalenessDependencies
): Promise<AgentMemoryStaleFinding[]> {
  const findings: AgentMemoryStaleFinding[] = []
  for (const reference of extractPullRequestReferences(text)) {
    const state = await dependencies.fetchPullRequestState(reference)
    if (state === 'MERGED' || state === 'CLOSED') {
      const label = `${reference.repository ?? ''}#${reference.number}`
      findings.push({
        reason: state === 'MERGED' ? 'PR_MERGED' : 'PR_CLOSED',
        key: pullRequestKey(reference),
        detail: `PR ${label} is ${state.toLowerCase()}`
      })
    }
  }
  const files = dependencies.baseRefFiles
  if (files) {
    const topLevel = new Set([...files].map((file) => file.split('/')[0]))
    for (const path of extractRepoPathReferences(text)) {
      if (topLevel.has(path.split('/')[0]) && !files.has(path)) {
        findings.push({
          reason: 'PATH_MISSING_ON_MAIN',
          key: `PATH:${path}`,
          detail: `${path} no longer exists on the base ref`
        })
      }
    }
  }
  return findings
}
