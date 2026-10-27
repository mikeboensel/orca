import type {
  AgentMemoryFileChange,
  AgentMemoryFileChangeOwner
} from '../../shared/agent-memory/agent-memory-review-types'
import { readTextFileOrNull, replaceTextFileIfUnchanged } from './agent-memory-file-io'

export class AgentMemoryFileChangeConflict extends Error {}

/**
 * Ordered file changes planned against an overlay of the earlier ones, so two decisions that touch
 * the same file (e.g. two MEMORY.md lines) chain instead of conflicting.
 */
export class AgentMemoryFileChangeBatch {
  readonly changes: AgentMemoryFileChange[] = []
  private readonly overlay = new Map<string, string | null>()

  checkpoint(): () => void {
    const length = this.changes.length
    const overlay = new Map(this.overlay)
    return () => {
      this.changes.length = length
      this.overlay.clear()
      overlay.forEach((text, path) => this.overlay.set(path, text))
    }
  }

  async read(path: string): Promise<string | null> {
    return this.overlay.has(path) ? (this.overlay.get(path) ?? null) : readTextFileOrNull(path)
  }

  async write(
    path: string,
    afterText: string | null,
    owner: AgentMemoryFileChangeOwner
  ): Promise<void> {
    const beforeText = await this.read(path)
    if (beforeText === afterText) {
      return
    }
    this.changes.push({
      kind: afterText === null ? 'delete' : 'write',
      path,
      owner,
      beforeText,
      afterText
    })
    this.overlay.set(path, afterText)
  }

  async move(path: string, toPath: string, owner: AgentMemoryFileChangeOwner): Promise<void> {
    const beforeText = await this.read(path)
    if (beforeText === null) {
      throw new AgentMemoryFileChangeConflict(`${path} no longer exists`)
    }
    if ((await this.read(toPath)) !== null) {
      throw new AgentMemoryFileChangeConflict(`${toPath} already exists`)
    }
    this.changes.push({ kind: 'move', path, toPath, owner, beforeText, afterText: beforeText })
    this.overlay.set(path, null)
    this.overlay.set(toPath, beforeText)
  }
}

async function applyOne(change: AgentMemoryFileChange): Promise<boolean> {
  if (change.kind === 'move') {
    if (
      !change.toPath ||
      !(await replaceTextFileIfUnchanged(change.toPath, null, change.beforeText ?? ''))
    ) {
      return false
    }
    return replaceTextFileIfUnchanged(change.path, change.beforeText, null)
  }
  return replaceTextFileIfUnchanged(change.path, change.beforeText, change.afterText)
}

function inverse(change: AgentMemoryFileChange): AgentMemoryFileChange {
  if (change.kind === 'move') {
    return { ...change, path: change.toPath ?? change.path, toPath: change.path }
  }
  return {
    ...change,
    kind: change.beforeText === null ? 'delete' : 'write',
    beforeText: change.afterText,
    afterText: change.beforeText
  }
}

/** Disk state each path must have before the batch: its first change's `beforeText`. */
function expectedInitialTexts(
  changes: readonly AgentMemoryFileChange[]
): Map<string, string | null> {
  const expected = new Map<string, string | null>()
  for (const change of changes) {
    if (!expected.has(change.path)) {
      expected.set(change.path, change.beforeText)
    }
    if (change.kind === 'move' && change.toPath && !expected.has(change.toPath)) {
      expected.set(change.toPath, null)
    }
  }
  return expected
}

/**
 * Checks every file against the preview first, then applies in order; a failure part-way rolls
 * the applied prefix back so a batch lands whole or not at all.
 */
export async function applyFileChanges(changes: readonly AgentMemoryFileChange[]): Promise<void> {
  for (const [path, text] of expectedInitialTexts(changes)) {
    if ((await readTextFileOrNull(path)) !== text) {
      throw new AgentMemoryFileChangeConflict(`${path} changed since the preview`)
    }
  }
  const applied: AgentMemoryFileChange[] = []
  for (const change of changes) {
    if (!(await applyOne(change))) {
      for (const done of applied.toReversed()) {
        await applyOne(inverse(done)).catch(() => false)
      }
      throw new AgentMemoryFileChangeConflict(`${change.path} changed while applying`)
    }
    applied.push(change)
  }
}

/** Undo: the inverse changes in reverse order, guarded the same way. */
export async function revertFileChanges(
  changes: readonly AgentMemoryFileChange[]
): Promise<string[]> {
  const inverseChanges = changes.toReversed().map(inverse)
  await applyFileChanges(inverseChanges)
  return [...new Set(inverseChanges.map((change) => change.toPath ?? change.path))]
}
