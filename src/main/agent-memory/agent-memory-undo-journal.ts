import { randomUUID } from 'node:crypto'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isPlainObject } from '../../shared/agent-memory/agent-memory-document-format'
import {
  AGENT_MEMORY_FILE_CHANGE_KINDS,
  AGENT_MEMORY_FILE_CHANGE_OWNERS,
  type AgentMemoryFileChange
} from '../../shared/agent-memory/agent-memory-review-types'
import type { AgentMemoryReviewRecord } from '../../shared/agent-memory/agent-memory-types'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import { readTextFileOrNull, writeTextFileAtomically } from './agent-memory-file-io'
import { parseReviewRecord } from './agent-memory-review-file'

export const UNDO_JOURNAL_KEEP_COUNT = 100
const UNDO_ID_PATTERN = /^[0-9a-f-]{36}$/

export type RecordSnapshot = {
  reviewFilePath: string
  recordId: string
  before: AgentMemoryReviewRecord | null
}

export type UndoJournal = { fileChanges: AgentMemoryFileChange[]; records: RecordSnapshot[] }

function undoDirectory(storeRootDirectory: string): string {
  return join(storeRootDirectory, 'undo')
}

function undoJournalPath(storeRootDirectory: string, undoId: string): string {
  if (!UNDO_ID_PATTERN.test(undoId)) {
    throw new Error('Invalid undo id')
  }
  return join(undoDirectory(storeRootDirectory), `${undoId}.json`)
}

function parseFileChange(value: unknown): AgentMemoryFileChange | null {
  if (!isPlainObject(value) || typeof value.path !== 'string') {
    return null
  }
  const kind = AGENT_MEMORY_FILE_CHANGE_KINDS.find((candidate) => candidate === value.kind)
  const owner = AGENT_MEMORY_FILE_CHANGE_OWNERS.find((candidate) => candidate === value.owner)
  const text = (field: unknown): string | null => (typeof field === 'string' ? field : null)
  if (!kind || !owner) {
    return null
  }
  return {
    kind,
    path: value.path,
    owner,
    ...(typeof value.toPath === 'string' ? { toPath: value.toPath } : {}),
    beforeText: text(value.beforeText),
    afterText: text(value.afterText)
  }
}

function parseSnapshot(value: unknown): RecordSnapshot | null {
  if (
    !isPlainObject(value) ||
    typeof value.reviewFilePath !== 'string' ||
    typeof value.recordId !== 'string'
  ) {
    return null
  }
  return {
    reviewFilePath: value.reviewFilePath,
    recordId: value.recordId,
    before: value.before === null ? null : parseReviewRecord(value.before)
  }
}

/** A journal with any unreadable entry is refused whole, so undo never half-applies. */
function parseJournal(text: string | null): UndoJournal | null {
  if (text === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      !isPlainObject(parsed) ||
      !Array.isArray(parsed.fileChanges) ||
      !Array.isArray(parsed.records)
    ) {
      return null
    }
    const fileChanges = parsed.fileChanges.map(parseFileChange)
    const records = parsed.records.map(parseSnapshot)
    if (fileChanges.includes(null) || records.includes(null)) {
      return null
    }
    return {
      fileChanges: fileChanges.filter((change) => change !== null),
      records: records.filter((record) => record !== null)
    }
  } catch {
    return null
  }
}

/** Keeps the newest journals; older batches can no longer be undone. */
async function pruneUndoJournals(storeRootDirectory: string): Promise<void> {
  const directory = undoDirectory(storeRootDirectory)
  let names: string[]
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.json'))
  } catch (error) {
    if (isDefinitiveAbsence(error)) {
      return
    }
    throw error
  }
  if (names.length <= UNDO_JOURNAL_KEEP_COUNT) {
    return
  }
  const dated = await Promise.all(
    names.map(async (name) => ({ name, mtimeMs: (await stat(join(directory, name))).mtimeMs }))
  )
  dated.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
  for (const { name } of dated.slice(UNDO_JOURNAL_KEEP_COUNT)) {
    await rm(join(directory, name), { force: true })
  }
}

export async function writeUndoJournal(
  storeRootDirectory: string,
  journal: UndoJournal
): Promise<string> {
  const undoId = randomUUID()
  await writeTextFileAtomically(
    undoJournalPath(storeRootDirectory, undoId),
    `${JSON.stringify(journal, null, 2)}\n`
  )
  await pruneUndoJournals(storeRootDirectory)
  return undoId
}

export async function readUndoJournal(
  storeRootDirectory: string,
  undoId: string
): Promise<UndoJournal> {
  const journal = parseJournal(
    await readTextFileOrNull(undoJournalPath(storeRootDirectory, undoId))
  )
  if (!journal) {
    throw new Error('Nothing to undo for this id')
  }
  return journal
}

export async function removeUndoJournal(storeRootDirectory: string, undoId: string): Promise<void> {
  await rm(undoJournalPath(storeRootDirectory, undoId), { force: true })
}
