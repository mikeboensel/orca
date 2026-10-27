import { describe, expect, it } from 'vitest'
import { findStaleFindings } from './agent-memory-staleness'

describe('memory staleness', () => {
  it('flags merged or closed PRs of this repo and URL PRs, but not other repos named in prose', async () => {
    const asked: string[] = []
    const findings = await findStaleFindings(
      'Landed in PR #12; see https://github.com/acme/api/pull/7. ktor-utils PR #44 is blocked, also api-ktor #582.',
      {
        baseRefFiles: null,
        fetchPullRequestState: async (reference) => {
          asked.push(`${reference.repository ?? ''}#${reference.number}`)
          return reference.number === 12 ? 'MERGED' : 'CLOSED'
        }
      }
    )
    expect(asked).toEqual(['acme/api#7', '#12'])
    expect(findings.map((finding) => finding.key)).toEqual(['PR:acme/api#7', 'PR:#12'])
  })

  it('flags a named path only when its top-level folder still exists on main', async () => {
    const findings = await findStaleFindings(
      'Edit `src/gone.ts`, keep src/here.ts, ignore other-repo/x.ts and ~/.claude/CLAUDE.md.',
      {
        baseRefFiles: new Set(['src/here.ts', 'package.json']),
        fetchPullRequestState: async () => null
      }
    )
    expect(findings).toEqual([
      {
        reason: 'PATH_MISSING_ON_MAIN',
        key: 'PATH:src/gone.ts',
        detail: 'src/gone.ts no longer exists on the base ref'
      }
    ])
  })
})
