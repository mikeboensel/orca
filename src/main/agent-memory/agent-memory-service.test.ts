import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentMemoryScopeRequest } from '../../shared/agent-memory/agent-memory-review-types'
import type {
  AgentMemoryDecision,
  AgentMemoryItem
} from '../../shared/agent-memory/agent-memory-types'
import { encodeClaudeProjectPath } from '../ai-vault/claude-project-dir-encoding'
import { AgentMemoryService } from './agent-memory-service'

let root: string
let home: string
let repo: string
let worktree: string
let service: AgentMemoryService
let scope: AgentMemoryScopeRequest

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' })

function memoryDir(checkout: string): string {
  return join(home, '.claude', 'projects', encodeClaudeProjectPath(checkout), 'memory')
}

function memoryFile(name: string, type: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${name} summary\nmetadata:\n  type: ${type}\n---\n\n${body}\n`
}

async function writeMemory(checkout: string, fileName: string, text: string): Promise<void> {
  await mkdir(memoryDir(checkout), { recursive: true })
  await writeFile(join(memoryDir(checkout), fileName), text)
}

async function itemById(id: string): Promise<AgentMemoryItem> {
  const item = (await service.list(scope)).items.find((candidate) => candidate.id === id)
  if (!item) {
    throw new Error(`missing ${id}`)
  }
  return item
}

async function decide(
  id: string,
  decision: AgentMemoryDecision,
  extra: { shares?: ('codex' | 'gemini')[]; editedText?: string } = {}
): Promise<{ undoId: string | null; changedPaths: string[] }> {
  const item = await itemById(id)
  const requests = [{ scope, itemId: id, contentHash: item.contentHash, decision, ...extra }]
  const preview = await service.previewDecisions(requests)
  expect(preview.rejected).toEqual([])
  const result = await service.applyDecisions({
    requests,
    previewFingerprint: preview.previewFingerprint
  })
  return { undoId: result.undoId, changedPaths: preview.fileChanges.map((change) => change.path) }
}

beforeEach(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'orca-agent-memory-')))
  home = join(root, 'home')
  repo = join(root, 'repos', 'demo')
  worktree = join(root, 'worktrees', 'demo-feature')
  await mkdir(repo, { recursive: true })
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.email', 'test@example.com')
  git(repo, 'config', 'user.name', 'Test')
  await mkdir(join(repo, 'src'), { recursive: true })
  await writeFile(join(repo, 'src', 'kept.ts'), 'export {}\n')
  await writeFile(join(repo, 'src', 'other.ts'), 'export {}\n')
  await writeFile(
    join(repo, 'CLAUDE.md'),
    '# Repo rules\n\n## Build\n\nRun pnpm build.\n\n## Test\n\nRun pnpm test.\n'
  )
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'init')
  git(repo, 'worktree', 'add', '-q', '-b', 'feature', worktree)
  service = new AgentMemoryService({
    storeRootDirectory: join(root, 'orca-user-data', 'agent-memory'),
    environment: { homeDirectory: home, processEnvironment: {} },
    now: () => new Date('2026-10-27T12:00:00Z')
  })
  scope = { kind: 'workspace', repoPath: repo }
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('AgentMemoryService workspace view', () => {
  it('unions main and worktree memory dirs, deduping identical copies', async () => {
    const shared = memoryFile('naming', 'feedback', 'Use explicit names.')
    await writeMemory(repo, 'feedback_naming.md', shared)
    await writeMemory(worktree, 'feedback_naming.md', shared)
    await writeMemory(
      worktree,
      'project_only_here.md',
      memoryFile('only-here', 'project', 'Worktree fact.')
    )
    const listing = await service.list(scope)
    const naming = listing.items.find((item) => item.id === 'claude-memory:feedback_naming.md')
    expect(naming?.locations.map((location) => location.worktreePath)).toEqual([null, worktree])
    expect(listing.items.some((item) => item.id === 'claude-memory:project_only_here.md')).toBe(
      true
    )
    expect(listing.unreviewedCount).toBe(listing.items.length)
  })

  it('reads in-repo CLAUDE.md from the base ref only', async () => {
    await writeFile(join(worktree, 'CLAUDE.md'), '# Repo rules\n\n## Branch only\n\nNot on main.\n')
    git(worktree, 'commit', '-qam', 'branch edit')
    const listing = await service.list(scope)
    const sections = listing.items.filter((item) => item.sourceKind === 'repo-claude-md-section')
    expect(sections.map((item) => item.sectionHeading)).toEqual(['Build', 'Test'])
    expect(listing.baseRef).toBe('main')
    expect(sections[0].editable).toBe(false)
  })

  it('marks content changes and stale paths unreviewed, and carries a record across a rename', async () => {
    await writeMemory(
      repo,
      'project_paths.md',
      memoryFile('paths', 'project', 'See src/kept.ts and src/gone.ts.')
    )
    await decide('claude-memory:project_paths.md', 'KEEP')
    expect((await itemById('claude-memory:project_paths.md')).unreviewedReasons).toEqual([])

    await writeMemory(repo, 'feedback_x.md', memoryFile('x', 'feedback', 'One.'))
    await decide('claude-memory:feedback_x.md', 'KEEP')
    await rename(
      join(memoryDir(repo), 'feedback_x.md'),
      join(memoryDir(repo), 'feedback_renamed.md')
    )
    expect((await itemById('claude-memory:feedback_renamed.md')).unreviewedReasons).toEqual([])
    await writeMemory(repo, 'feedback_renamed.md', memoryFile('x', 'feedback', 'Two.'))
    expect((await itemById('claude-memory:feedback_renamed.md')).unreviewedReasons).toEqual([
      'CONTENT_CHANGED'
    ])

    await writeMemory(
      repo,
      'project_stale.md',
      memoryFile('stale', 'project', 'Edit src/gone.ts first.')
    )
    await decide('claude-memory:project_stale.md', 'KEEP')
    git(repo, 'rm', '-q', 'src/kept.ts')
    git(repo, 'commit', '-qm', 'remove kept')
    const stale = await itemById('claude-memory:project_paths.md')
    expect(stale.unreviewedReasons).toEqual(['PATH_MISSING_ON_MAIN'])
    expect(stale.staleFindings.map((finding) => finding.key)).toEqual(['PATH:src/kept.ts'])
  })

  it('archives into memory/archive with its index line, and undo restores both', async () => {
    await writeMemory(repo, 'project_old.md', memoryFile('old', 'project', 'Old fact.'))
    await writeMemory(worktree, 'project_old.md', memoryFile('old', 'project', 'Old fact.'))
    const index = '- [Old](project_old.md) — old\n- [Other](feedback_other.md) — other\n'
    await writeFile(join(memoryDir(repo), 'MEMORY.md'), index)
    const { undoId, changedPaths } = await decide('claude-memory:project_old.md', 'ARCHIVE')
    expect(changedPaths).toContain(join(memoryDir(repo), 'MEMORY.md'))
    expect(existsSync(join(memoryDir(repo), 'archive', 'project_old.md'))).toBe(true)
    expect(existsSync(join(memoryDir(worktree), 'project_old.md'))).toBe(false)
    expect(await readFile(join(memoryDir(repo), 'MEMORY.md'), 'utf8')).toBe(
      '- [Other](feedback_other.md) — other\n'
    )
    expect(await service.history(scope, 'claude-memory:project_old.md')).toMatchObject([
      { event: 'DECIDED', decision: 'ARCHIVE' }
    ])

    await service.undo(undoId ?? '')
    expect(await readFile(join(memoryDir(repo), 'MEMORY.md'), 'utf8')).toBe(index)
    expect(existsSync(join(memoryDir(worktree), 'project_old.md'))).toBe(true)
    expect((await itemById('claude-memory:project_old.md')).unreviewedReasons).toEqual([
      'NO_RECORD'
    ])
  })

  it('merges one memory into another and archives the source', async () => {
    await writeMemory(repo, 'feedback_a.md', memoryFile('a', 'feedback', 'Rule A.'))
    await writeMemory(repo, 'feedback_b.md', memoryFile('b', 'feedback', 'Rule B.'))
    await writeFile(
      join(memoryDir(repo), 'MEMORY.md'),
      '- [A](feedback_a.md) — a\n- [B](feedback_b.md) — b\n'
    )
    const source = await itemById('claude-memory:feedback_a.md')
    const requests = [
      {
        scope,
        itemId: source.id,
        contentHash: source.contentHash,
        decision: 'MERGE' as const,
        mergeTargetId: 'claude-memory:feedback_b.md'
      }
    ]
    const preview = await service.previewDecisions(requests)
    await service.applyDecisions({ requests, previewFingerprint: preview.previewFingerprint })
    expect(await readFile(join(memoryDir(repo), 'feedback_b.md'), 'utf8')).toContain(
      'Rule B.\n\nRule A.'
    )
    expect(existsSync(join(memoryDir(repo), 'archive', 'feedback_a.md'))).toBe(true)
    expect(await readFile(join(memoryDir(repo), 'MEMORY.md'), 'utf8')).toBe(
      '- [B](feedback_b.md) — b\n'
    )
    expect((await itemById('claude-memory:feedback_b.md')).unreviewedReasons).toEqual(['NO_RECORD'])
    expect(await service.history(scope, 'claude-memory:feedback_a.md')).toMatchObject([
      { event: 'DECIDED', decision: 'MERGE' }
    ])
  })

  it('refuses to apply when a file changed after the preview', async () => {
    await writeMemory(repo, 'project_old.md', memoryFile('old', 'project', 'Old fact.'))
    const item = await itemById('claude-memory:project_old.md')
    const requests = [
      { scope, itemId: item.id, contentHash: item.contentHash, decision: 'DELETE' as const }
    ]
    const preview = await service.previewDecisions(requests)
    await writeMemory(repo, 'project_old.md', memoryFile('old', 'project', 'Edited by Claude.'))
    await expect(
      service.applyDecisions({ requests, previewFingerprint: preview.previewFingerprint })
    ).rejects.toThrow()
    expect(existsSync(join(memoryDir(repo), 'project_old.md'))).toBe(true)
  })

  it('shares to Codex through one link block and keeps the user text around it', async () => {
    await mkdir(join(home, '.codex'), { recursive: true })
    await writeFile(join(home, '.codex', 'AGENTS.md'), '# My Codex rules\n\n- Be brief\n')
    await writeMemory(
      repo,
      'feedback_naming.md',
      memoryFile('naming', 'feedback', 'Use explicit names.')
    )
    await decide('claude-memory:feedback_naming.md', 'SHARE', { shares: ['codex'] })
    const agentsMd = await readFile(join(home, '.codex', 'AGENTS.md'), 'utf8')
    expect(agentsMd.startsWith('# My Codex rules\n\n- Be brief\n')).toBe(true)
    const renderedPath = /read `([^`]+\.md)` and follow it/.exec(agentsMd)?.[1] ?? ''
    expect(await readFile(renderedPath, 'utf8')).toContain('Use explicit names.')
    expect((await itemById('claude-memory:feedback_naming.md')).shareStates).toMatchObject({
      claude: 'native',
      codex: 'shared',
      opencode: 'unavailable'
    })
    expect(existsSync(join(home, '.claude', 'CLAUDE.md'))).toBe(false)
  })

  it('loads audit verdicts as suggestions without marking anything reviewed', async () => {
    await writeMemory(repo, 'feedback_a.md', memoryFile('a', 'feedback', 'A.'))
    await writeMemory(repo, 'project_b.md', memoryFile('b', 'project', 'B.'))
    const audit = JSON.stringify([
      { file: 'feedback_a.md', verdict: 'CLAUDE_ONLY', reason: 'skill covers it' },
      { file: 'project_b.md', verdict: 'MERGE', reason: 'dup', mergeTarget: 'feedback_a.md' },
      { file: 'missing.md', verdict: 'SHARE', reason: '' }
    ])
    const result = await service.suggestFromAudit(scope, audit, 'audit')
    expect(result).toMatchObject({ unmatched: ['missing.md'], invalid: [] })
    const b = await itemById('claude-memory:project_b.md')
    expect(b.record?.suggestion).toMatchObject({
      verdict: 'MERGE',
      mergeTarget: 'claude-memory:feedback_a.md'
    })
    expect((await itemById('claude-memory:feedback_a.md')).record?.suggestion?.verdict).toBe('KEEP')
    expect(b.unreviewedReasons).toEqual(['NO_RECORD'])
  })

  it('adds a Claude-format memory with its index line, unreviewed', async () => {
    const id = await service.add(scope, {
      name: 'Deploy flow',
      type: 'project',
      description: 'How deploys run',
      body: 'Deploys go through the release bot.'
    })
    expect(id).toBe('claude-memory:project_deploy_flow.md')
    expect(await readFile(join(memoryDir(repo), 'MEMORY.md'), 'utf8')).toBe(
      '- [Deploy flow](project_deploy_flow.md) — How deploys run\n'
    )
    expect(await itemById(id)).toMatchObject({ type: 'project', unreviewedReasons: ['NO_RECORD'] })
  })
})

describe('AgentMemoryService global view', () => {
  it('splits CLAUDE.md into sections and edits one in place, staying reviewed', async () => {
    await mkdir(join(home, '.claude'), { recursive: true })
    const claudeMd = join(home, '.claude', 'CLAUDE.md')
    await writeFile(claudeMd, '# Prefs\n\n## Brevity\n\nBe concise.\n\n## Skills\n\nUse skills.\n')
    scope = { kind: 'global' }
    const id = 'claude:CLAUDE.md#Brevity'
    await decide(id, 'EDIT', { editedText: '## Brevity\n\nBe very concise.' })
    expect(await readFile(claudeMd, 'utf8')).toBe(
      '# Prefs\n\n## Brevity\n\nBe very concise.\n\n## Skills\n\nUse skills.\n'
    )
    expect((await itemById(id)).unreviewedReasons).toEqual([])
    expect(existsSync(join(home, '.claude', '.memory-review.json'))).toBe(true)
  })
})
