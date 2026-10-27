import { basename, dirname, join } from 'node:path'
import { splitMarkdownFrontmatter } from '../../shared/agent-memory/agent-memory-document-format'
import type { AgentMemoryItem } from '../../shared/agent-memory/agent-memory-types'
import {
  CLAUDE_MEMORY_ARCHIVE_DIRECTORY_NAME,
  CLAUDE_MEMORY_INDEX_FILE_NAME
} from './agent-memory-claude-project-memory-reader'
import {
  AgentMemoryFileChangeConflict,
  type AgentMemoryFileChangeBatch
} from './agent-memory-file-change-batch'
import { replaceMarkdownSection } from './agent-memory-markdown-sections'

/** Drops the MEMORY.md index lines that link `fileName`. */
async function removeIndexLink(
  batch: AgentMemoryFileChangeBatch,
  directory: string,
  fileName: string
): Promise<void> {
  const indexPath = join(directory, CLAUDE_MEMORY_INDEX_FILE_NAME)
  const before = await batch.read(indexPath)
  if (before === null) {
    return
  }
  const after = before
    .split('\n')
    .filter((line) => !line.includes(`](${fileName})`))
    .join('\n')
  await batch.write(indexPath, after, 'memory-source')
}

/** Archive moves every worktree copy into `memory/archive/`; delete removes it. Both drop the index line. */
export async function planClaudeMemoryRemoval(
  batch: AgentMemoryFileChangeBatch,
  item: AgentMemoryItem,
  mode: 'archive' | 'delete'
): Promise<void> {
  for (const location of item.locations) {
    const directory = dirname(location.path)
    const fileName = basename(location.path)
    await (mode === 'archive'
      ? batch.move(
          location.path,
          join(directory, CLAUDE_MEMORY_ARCHIVE_DIRECTORY_NAME, fileName),
          'memory-source'
        )
      : batch.write(location.path, null, 'memory-source'))
    await removeIndexLink(batch, directory, fileName)
  }
}

/** Frontmatter is kept for memory files; for instruction files only the one section is replaced. */
export async function planMemoryTextEdit(
  batch: AgentMemoryFileChangeBatch,
  item: AgentMemoryItem,
  nextText: string
): Promise<void> {
  for (const path of new Set(item.locations.map((location) => location.path))) {
    const before = await batch.read(path)
    if (before === null) {
      throw new AgentMemoryFileChangeConflict(`${path} no longer exists`)
    }
    let after: string | null
    if (item.sectionHeading !== null) {
      after = replaceMarkdownSection(before, item.sectionHeading, nextText)
    } else {
      const split = splitMarkdownFrontmatter(before)
      after = split
        ? `---\n${split.frontmatterText}\n---\n\n${nextText.trim()}\n`
        : `${nextText.trim()}\n`
    }
    if (after === null) {
      throw new AgentMemoryFileChangeConflict(
        `${path} no longer has section ${item.sectionHeading}`
      )
    }
    await batch.write(path, after, 'memory-source')
  }
}

/** Sections of ~/.claude/CLAUDE.md and ~/.codex/AGENTS.md; Orca may rewrite these files. */
export function isUserInstructionSection(item: AgentMemoryItem): boolean {
  return (
    item.sourceKind === 'claude-user-instructions-section' ||
    item.sourceKind === 'codex-user-instructions-section'
  )
}

/** `CLAUDE.md` → `CLAUDE.archive.md`: a sibling no agent loads. */
export function instructionArchivePath(path: string): string {
  return join(dirname(path), `${basename(path).replace(/\.md$/i, '')}.archive.md`)
}

/** Moves the section out of the loaded file and appends it to the sibling archive file. */
export async function planInstructionSectionArchive(
  batch: AgentMemoryFileChangeBatch,
  item: AgentMemoryItem
): Promise<void> {
  const path = item.locations[0].path
  await planMemoryTextEdit(batch, item, '')
  const archivePath = instructionArchivePath(path)
  const existing =
    (await batch.read(archivePath)) ??
    `<!-- Sections archived from ${basename(path)} by Orca. Agents do not load this file. -->\n`
  await batch.write(
    archivePath,
    `${existing.trimEnd()}\n\n${item.text.trimEnd()}\n`,
    'memory-source'
  )
}
