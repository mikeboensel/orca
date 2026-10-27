import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  isPlainObject,
  splitMarkdownFrontmatter
} from '../../shared/agent-memory/agent-memory-document-format'
import { isAgentMemoryType } from '../../shared/agent-memory/agent-memory-types'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import { encodeClaudeProjectPath } from '../ai-vault/claude-project-dir-encoding'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import { readTextFileOrNull } from './agent-memory-file-io'
import {
  MEMORY_REVIEW_FILE_NAME,
  type AgentMemorySourceEntry,
  type AgentMemorySourceReader
} from './agent-memory-source-reader'
import { resolveClaudeCodeHome } from './claude-code-agent-memory-adapter'

/** Claude's index of the memory dir; not a memory itself. */
export const CLAUDE_MEMORY_INDEX_FILE_NAME = 'MEMORY.md'
export const CLAUDE_MEMORY_ARCHIVE_DIRECTORY_NAME = 'archive'

export function claudeProjectMemoryDirectory(
  environment: AgentMemoryAdapterEnvironment,
  checkoutPath: string
): string {
  return join(
    resolveClaudeCodeHome(environment),
    'projects',
    encodeClaudeProjectPath(checkoutPath),
    'memory'
  )
}

export function claudeMemoryItemId(fileName: string): string {
  return `claude-memory:${fileName}`
}

export function parseClaudeMemoryFile(
  fileName: string,
  text: string
): Pick<AgentMemorySourceEntry, 'title' | 'description' | 'type' | 'text'> {
  const split = splitMarkdownFrontmatter(text)
  const frontmatter = split && isPlainObject(split.frontmatter) ? split.frontmatter : {}
  const metadata = isPlainObject(frontmatter.metadata) ? frontmatter.metadata : {}
  const type = isAgentMemoryType(metadata.type)
    ? metadata.type
    : isAgentMemoryType(frontmatter.type)
      ? frontmatter.type
      : 'project'
  return {
    title:
      typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : fileName,
    description: typeof frontmatter.description === 'string' ? frontmatter.description.trim() : '',
    type,
    text: (split?.body ?? text).trim()
  }
}

async function readMemoryDirectory(
  directory: string,
  worktreePath: string | null
): Promise<AgentMemorySourceEntry[]> {
  let names: string[]
  try {
    names = await readdir(directory)
  } catch (error) {
    if (isDefinitiveAbsence(error)) {
      return []
    }
    throw error
  }
  const entries: AgentMemorySourceEntry[] = []
  for (const fileName of names.sort()) {
    if (!fileName.endsWith('.md') || fileName === CLAUDE_MEMORY_INDEX_FILE_NAME) {
      continue
    }
    const path = join(directory, fileName)
    const fileText = await readTextFileOrNull(path)
    if (fileText === null) {
      continue
    }
    entries.push({
      id: claudeMemoryItemId(fileName),
      sourceKind: 'claude-project-memory-file',
      nativeAgent: 'claude',
      ...parseClaudeMemoryFile(fileName, fileText),
      path,
      sectionKey: null,
      worktreePath,
      modifiedAt: (await stat(path)).mtime.toISOString(),
      editable: true,
      nativeArchive: true,
      reviewFilePath: join(directory, MEMORY_REVIEW_FILE_NAME)
    })
  }
  return entries
}

/** Claude keys project memory by checkout path, so each worktree may hold its own copy. */
export const CLAUDE_PROJECT_MEMORY_READER: AgentMemorySourceReader = {
  sourceKind: 'claude-project-memory-file',
  readWorkspace: async (environment, workspace) => {
    const checkouts: { path: string; worktreePath: string | null }[] = [
      { path: workspace.repoPath, worktreePath: null },
      ...workspace.worktreePaths.map((path) => ({ path, worktreePath: path }))
    ]
    const entries: AgentMemorySourceEntry[] = []
    for (const checkout of checkouts) {
      entries.push(
        ...(await readMemoryDirectory(
          claudeProjectMemoryDirectory(environment, checkout.path),
          checkout.worktreePath
        ))
      )
    }
    return entries
  }
}
