import { existsSync, mkdtempSync, realpathSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentMemoryDecision } from '../../shared/agent-memory/agent-memory-types'
import { AgentMemoryService } from './agent-memory-service'
import { UNDO_JOURNAL_KEEP_COUNT } from './agent-memory-undo-journal'

let root: string
let home: string
let storeRoot: string
let service: AgentMemoryService
const scope = { kind: 'global' } as const
const CLAUDE_MD = '# Prefs\n\n## Brevity\n\nBe concise.\n\n## Skills\n\nUse skills.\n'

function claudeMd(): string {
  return join(home, '.claude', 'CLAUDE.md')
}

async function decide(id: string, decision: AgentMemoryDecision, shares?: 'codex'[]) {
  const item = (await service.list(scope)).items.find((candidate) => candidate.id === id)
  if (!item) {
    throw new Error(`missing ${id}`)
  }
  const requests = [{ scope, itemId: id, contentHash: item.contentHash, decision, shares }]
  const preview = await service.previewDecisions(requests)
  const result = await service.applyDecisions({
    requests,
    previewFingerprint: preview.previewFingerprint
  })
  return { preview, result }
}

beforeEach(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'orca-agent-memory-global-')))
  home = join(root, 'home')
  storeRoot = join(root, 'orca-user-data', 'agent-memory')
  await mkdir(join(home, '.claude'), { recursive: true })
  await mkdir(join(home, '.codex'), { recursive: true })
  await writeFile(claudeMd(), CLAUDE_MD)
  service = new AgentMemoryService({
    storeRootDirectory: storeRoot,
    environment: { homeDirectory: home, processEnvironment: {} }
  })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('global memory review', () => {
  it('archives a CLAUDE.md section into CLAUDE.archive.md and undo restores both files', async () => {
    const { preview, result } = await decide('claude:CLAUDE.md#Brevity', 'ARCHIVE')
    expect(preview.fileChanges.map((change) => change.path)).toEqual([
      claudeMd(),
      join(home, '.claude', 'CLAUDE.archive.md')
    ])
    expect(await readFile(claudeMd(), 'utf8')).not.toContain('Be concise.')
    expect(await readFile(join(home, '.claude', 'CLAUDE.archive.md'), 'utf8')).toContain(
      '## Brevity\n\nBe concise.'
    )
    await service.undo(result.undoId ?? '')
    expect(await readFile(claudeMd(), 'utf8')).toBe(CLAUDE_MD)
    expect(existsSync(join(home, '.claude', 'CLAUDE.archive.md'))).toBe(false)
  })

  it('leaves a hand-edited link block alone and reports it', async () => {
    await decide('claude:CLAUDE.md#Brevity', 'SHARE', ['codex'])
    const agentsMd = join(home, '.codex', 'AGENTS.md')
    const edited = (await readFile(agentsMd, 'utf8')).replace('Before starting', 'Before beginning')
    await writeFile(agentsMd, edited)
    const { preview } = await decide('claude:CLAUDE.md#Skills', 'SHARE', ['codex'])
    expect(preview.warnings.some((warning) => warning.startsWith(`${agentsMd}:`))).toBe(true)
    expect(preview.fileChanges.some((change) => change.owner === 'agent-link-block')).toBe(false)
    expect(await readFile(agentsMd, 'utf8')).toBe(edited)
  })

  it('pauses a share once the memory changes, until it is shared again', async () => {
    await decide('claude:CLAUDE.md#Brevity', 'SHARE', ['codex'])
    const rendered = join(storeRoot, 'rendered', 'global.md')
    expect(await readFile(rendered, 'utf8')).toContain('Be concise.')
    await writeFile(claudeMd(), CLAUDE_MD.replace('Be concise.', 'Be terse.'))
    const item = (await service.list(scope)).items.find(
      (candidate) => candidate.id === 'claude:CLAUDE.md#Brevity'
    )
    expect(item?.shareStates.codex).toBe('paused')
    expect(await readFile(rendered, 'utf8')).not.toContain('Be terse.')
    expect(await readFile(rendered, 'utf8')).not.toContain('Be concise.')
    await decide('claude:CLAUDE.md#Brevity', 'SHARE', ['codex'])
    expect(await readFile(rendered, 'utf8')).toContain('Be terse.')
  })

  it(`keeps only the newest ${UNDO_JOURNAL_KEEP_COUNT} undo journals`, async () => {
    const undoDirectory = join(storeRoot, 'undo')
    await mkdir(undoDirectory, { recursive: true })
    const old = new Date('2026-01-01T00:00:00Z')
    for (let index = 0; index < UNDO_JOURNAL_KEEP_COUNT + 5; index += 1) {
      const path = join(
        undoDirectory,
        `00000000-0000-4000-8000-${String(index).padStart(12, '0')}.json`
      )
      await writeFile(path, '{}')
      await utimes(path, old, old)
    }
    const { result } = await decide('claude:CLAUDE.md#Brevity', 'KEEP')
    const remaining = await readdir(undoDirectory)
    expect(remaining).toHaveLength(UNDO_JOURNAL_KEEP_COUNT)
    expect(remaining).toContain(`${result.undoId}.json`)
  })
})
