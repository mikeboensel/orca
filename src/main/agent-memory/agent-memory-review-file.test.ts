import { mkdtempSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  emptyReviewRecord,
  readReviewRecords,
  updateReviewRecords
} from './agent-memory-review-file'

const root = realpathSync(mkdtempSync(join(tmpdir(), 'orca-memory-review-file-')))
const path = join(root, '.memory-review.json')

afterEach(async () => {
  await rm(path, { force: true })
  await rm(`${path}.lock`, { recursive: true, force: true })
})

describe('memory review file', () => {
  it('keeps every concurrent writer and records written by another process', async () => {
    await writeFile(
      path,
      JSON.stringify({ version: 1, records: { other: emptyReviewRecord('h0') } })
    )
    await Promise.all(
      ['a', 'b', 'c'].map((id) =>
        updateReviewRecords(path, (records) => {
          records[id] = emptyReviewRecord(`h-${id}`)
        })
      )
    )
    expect(Object.keys(await readReviewRecords(path))).toEqual(['a', 'b', 'c', 'other'])
  })

  it('drops malformed records and unknown enum values instead of failing', async () => {
    await writeFile(
      path,
      JSON.stringify({
        records: {
          good: {
            contentHash: 'h',
            decision: 'MAYBE',
            shares: ['codex', 'cursor'],
            history: [{ at: 'x', event: 'NOPE' }]
          },
          bad: { decision: 'KEEP' }
        }
      })
    )
    expect(await readReviewRecords(path)).toEqual({
      good: { contentHash: 'h', shares: ['codex'], acknowledgedStaleness: [], history: [] }
    })
    expect(await readFile(path, 'utf8')).toContain('MAYBE')
  })

  it('takes over a lock left behind by a process that died', async () => {
    await mkdir(`${path}.lock`)
    const old = new Date(Date.now() - 60_000)
    await utimes(`${path}.lock`, old, old)
    await updateReviewRecords(path, (records) => {
      records.after = emptyReviewRecord('h')
    })
    expect(Object.keys(await readReviewRecords(path))).toEqual(['after'])
  })
})
