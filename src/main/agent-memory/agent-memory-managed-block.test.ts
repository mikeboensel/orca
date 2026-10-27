import { describe, expect, it } from 'vitest'
import { findManagedBlock, writeManagedBlock } from './agent-memory-managed-block'

const USER_TEXT = '# My rules\n\n- Be concise\n'

describe('managed block', () => {
  it('round-trips insert, replace and remove without touching user text', () => {
    const inserted = writeManagedBlock(USER_TEXT, 'first', 'end')
    expect(inserted.startsWith(USER_TEXT)).toBe(true)
    const replaced = writeManagedBlock(inserted, 'second', 'end')
    const lookup = findManagedBlock(replaced)
    expect(lookup).toMatchObject({ kind: 'present', innerText: 'second', intact: true })
    expect(writeManagedBlock(replaced, null, 'end')).toBe(USER_TEXT)
  })

  it('keeps text on both sides of a block placed at the start', () => {
    const inserted = writeManagedBlock(USER_TEXT, 'index', 'start')
    const userAppended = `${inserted}- Claude added this\n`
    const replaced = writeManagedBlock(userAppended, 'new index', 'start')
    expect(replaced.endsWith(`${USER_TEXT}- Claude added this\n`)).toBe(true)
    expect(writeManagedBlock(replaced, null, 'start')).toBe(`${USER_TEXT}- Claude added this\n`)
  })

  it('detects edits inside the block but not CRLF conversion', () => {
    const written = writeManagedBlock(USER_TEXT, 'line one\nline two', 'end')
    expect(findManagedBlock(written.replace(/\n/g, '\r\n'))).toMatchObject({ intact: true })
    expect(findManagedBlock(written.replace('line two', 'line 2'))).toMatchObject({
      kind: 'present',
      intact: false
    })
  })

  it('reports duplicate or unterminated blocks as malformed and refuses to rewrite them', () => {
    const written = writeManagedBlock('', 'x', 'end')
    expect(findManagedBlock(`${written}\n${written}`).kind).toBe('malformed')
    const unterminated = written.replace('<!-- orca-agent-memory:end -->', '')
    expect(findManagedBlock(unterminated).kind).toBe('malformed')
    expect(() => writeManagedBlock(unterminated, 'y', 'end')).toThrow()
  })
})
