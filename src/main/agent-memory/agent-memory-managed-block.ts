import { createHash } from 'node:crypto'

const BLOCK_BEGIN_PATTERN = /^<!-- orca-agent-memory:begin sha256=([0-9a-f]{64}) -->$/
const BLOCK_BEGIN_PREFIX = '<!-- orca-agent-memory:begin'
const BLOCK_END_LINE = '<!-- orca-agent-memory:end -->'

export type ManagedBlockPlacement = 'start' | 'end'

export type ManagedBlockLookup =
  | { kind: 'absent' }
  | { kind: 'malformed' }
  | {
      kind: 'present'
      /** Character offsets of the block including both marker lines. */
      start: number
      end: number
      innerText: string
      /** False when someone edited the block since Orca wrote it. */
      intact: boolean
    }

/** CRLF-normalized so line-ending conversion alone is not drift. */
export function agentMemoryContentSha256(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n').trimEnd()).digest('hex')
}

export function renderManagedBlock(innerText: string): string {
  const inner = innerText.trimEnd()
  return `<!-- orca-agent-memory:begin sha256=${agentMemoryContentSha256(inner)} -->\n${inner}\n${BLOCK_END_LINE}`
}

export function findManagedBlock(fileText: string): ManagedBlockLookup {
  const beginIndex = fileText.indexOf(BLOCK_BEGIN_PREFIX)
  if (beginIndex === -1) {
    return { kind: 'absent' }
  }
  if (fileText.includes(BLOCK_BEGIN_PREFIX, beginIndex + 1)) {
    return { kind: 'malformed' }
  }
  const beginLineEnd = fileText.indexOf('\n', beginIndex)
  const endIndex = fileText.indexOf(BLOCK_END_LINE, beginIndex)
  if (beginLineEnd === -1 || endIndex === -1 || endIndex < beginLineEnd) {
    return { kind: 'malformed' }
  }
  const beginLine = fileText.slice(beginIndex, beginLineEnd).replace(/\r$/, '')
  const recorded = BLOCK_BEGIN_PATTERN.exec(beginLine)?.[1]
  const innerText = fileText.slice(beginLineEnd + 1, endIndex).replace(/\r?\n$/, '')
  return {
    kind: 'present',
    start: beginIndex,
    end: endIndex + BLOCK_END_LINE.length,
    innerText,
    intact: recorded !== undefined && recorded === agentMemoryContentSha256(innerText)
  }
}

/** Inserts, replaces, or (with null) removes the block; text outside it is preserved byte-for-byte. */
export function writeManagedBlock(
  fileText: string,
  innerText: string | null,
  placement: ManagedBlockPlacement
): string {
  const lookup = findManagedBlock(fileText)
  if (lookup.kind === 'malformed') {
    throw new Error('Cannot rewrite a malformed Orca agent memory block')
  }
  if (lookup.kind === 'present') {
    if (innerText === null) {
      // Inverse of insertion: drop the blank-line separator Orca added on either side.
      const before = fileText.slice(0, lookup.start).trimEnd()
      const after = fileText.slice(lookup.end).replace(/^(\r?\n)+/, '')
      if (before.length === 0) {
        return after
      }
      return after.length === 0 ? `${before}\n` : `${before}\n\n${after}`
    }
    return `${fileText.slice(0, lookup.start)}${renderManagedBlock(innerText)}${fileText.slice(lookup.end)}`
  }
  if (innerText === null) {
    return fileText
  }
  const block = renderManagedBlock(innerText)
  if (fileText.trim().length === 0) {
    return `${block}\n`
  }
  if (placement === 'start') {
    return `${block}\n\n${fileText}`
  }
  return `${fileText.replace(/\s*$/, '')}\n\n${block}\n`
}
