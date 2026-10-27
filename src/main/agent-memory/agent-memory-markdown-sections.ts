import { findManagedBlock } from './agent-memory-managed-block'

export type MarkdownSection = {
  /** Heading text, `#2` suffixed when repeated; `(preamble)` for text before the first heading. */
  key: string
  heading: string | null
  /** Section text including its heading line. */
  text: string
  start: number
  end: number
}

const PREAMBLE_KEY = '(preamble)'
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/

function headingLevel(line: string): number {
  return HEADING_PATTERN.exec(line)?.[1].length ?? 0
}

/** The level that splits the file: the shallowest heading used more than once, else the shallowest. */
function splitLevel(lines: readonly string[]): number {
  const counts = new Map<number, number>()
  let inFence = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
    }
    const level = inFence ? 0 : headingLevel(line)
    if (level > 0) {
      counts.set(level, (counts.get(level) ?? 0) + 1)
    }
  }
  const levels = [...counts.keys()].sort()
  return levels.find((level) => (counts.get(level) ?? 0) > 1) ?? levels[0] ?? 0
}

/** Splits instructions into reviewable sections; Orca's own managed block is excluded. */
export function splitMarkdownSections(fileText: string): MarkdownSection[] {
  const block = findManagedBlock(fileText)
  const masked =
    block.kind === 'present'
      ? `${fileText.slice(0, block.start)}${' '.repeat(block.end - block.start)}${fileText.slice(block.end)}`
      : fileText
  const lines = masked.split('\n')
  const level = splitLevel(lines)
  const sections: MarkdownSection[] = []
  const seen = new Map<string, number>()
  let offset = 0
  let current: { heading: string | null; start: number } = { heading: null, start: 0 }
  let inFence = false
  const close = (end: number): void => {
    // A title line alone (e.g. `# Repo rules` above the split headings) is not a memory.
    const bodyLines = masked
      .slice(current.start, end)
      .split('\n')
      .filter((line) => line.trim().length > 0 && !HEADING_PATTERN.test(line))
    if (bodyLines.length === 0) {
      return
    }
    const base = current.heading ?? PREAMBLE_KEY
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    sections.push({
      key: count === 1 ? base : `${base}#${count}`,
      heading: current.heading,
      // Drop the blanked-out managed block if it sat inside this section.
      text: masked
        .slice(current.start, end)
        .replace(/ {40,}/g, '')
        .trimEnd(),
      start: current.start,
      end
    })
  }
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
    }
    const match = inFence ? null : HEADING_PATTERN.exec(line)
    if (level > 0 && match && match[1].length === level) {
      close(offset)
      current = { heading: match[2], start: offset }
    }
    offset += line.length + 1
  }
  close(fileText.length)
  return sections
}

/** Replaces one section's text, keeping everything else byte for byte. */
export function replaceMarkdownSection(
  fileText: string,
  sectionKey: string,
  nextSectionText: string
): string | null {
  const section = splitMarkdownSections(fileText).find((candidate) => candidate.key === sectionKey)
  if (!section) {
    return null
  }
  const trailing = fileText.slice(section.start, section.end).match(/\s*$/)?.[0] ?? ''
  return `${fileText.slice(0, section.start)}${nextSectionText.trimEnd()}${trailing}${fileText.slice(section.end)}`
}
