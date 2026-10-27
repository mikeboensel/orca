import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  AgentMemoryAgent,
  AgentMemorySourceKind
} from '../../shared/agent-memory/agent-memory-types'
import type { AgentMemoryAdapterEnvironment } from './agent-memory-agent-adapter'
import { readTextFileOrNull } from './agent-memory-file-io'
import { splitMarkdownSections } from './agent-memory-markdown-sections'
import {
  MEMORY_REVIEW_FILE_NAME,
  type AgentMemorySourceEntry,
  type AgentMemorySourceReader
} from './agent-memory-source-reader'
import { resolveClaudeCodeHome } from './claude-code-agent-memory-adapter'
import { resolveCodexSystemHome } from './codex-agent-memory-adapter'

/** In-repo review state lives in the shared git dir: untracked and common to all worktrees. */
export const REPO_MEMORY_REVIEW_FILE_NAME = 'memory-review.json'

export function firstProseLine(text: string): string {
  const line = text
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0 && !candidate.startsWith('#'))
  return (line ?? '').slice(0, 200)
}

export function sectionEntries(options: {
  fileText: string
  path: string
  idPrefix: string
  sourceKind: AgentMemorySourceKind
  nativeAgent: AgentMemoryAgent
  modifiedAt: string
  editable: boolean
  reviewFilePath: string
}): AgentMemorySourceEntry[] {
  return splitMarkdownSections(options.fileText).map((section) => ({
    id: `${options.idPrefix}#${section.key}`,
    sourceKind: options.sourceKind,
    nativeAgent: options.nativeAgent,
    title: section.heading ?? section.key,
    description: firstProseLine(section.text),
    type: 'instruction',
    text: section.text,
    path: options.path,
    sectionKey: section.key,
    worktreePath: null,
    modifiedAt: options.modifiedAt,
    editable: options.editable,
    nativeArchive: false,
    reviewFilePath: options.reviewFilePath
  }))
}

function userInstructionsReader(options: {
  sourceKind: AgentMemorySourceKind
  nativeAgent: AgentMemoryAgent
  idPrefix: string
  resolvePath: (environment: AgentMemoryAdapterEnvironment) => string
}): AgentMemorySourceReader {
  return {
    sourceKind: options.sourceKind,
    readGlobal: async (environment) => {
      const path = options.resolvePath(environment)
      const fileText = await readTextFileOrNull(path)
      if (fileText === null) {
        return []
      }
      return sectionEntries({
        ...options,
        fileText,
        path,
        modifiedAt: (await stat(path)).mtime.toISOString(),
        editable: true,
        reviewFilePath: join(dirname(path), MEMORY_REVIEW_FILE_NAME)
      })
    }
  }
}

export const CLAUDE_USER_INSTRUCTIONS_READER = userInstructionsReader({
  sourceKind: 'claude-user-instructions-section',
  nativeAgent: 'claude',
  idPrefix: 'claude:CLAUDE.md',
  resolvePath: (environment) => join(resolveClaudeCodeHome(environment), 'CLAUDE.md')
})

export const CODEX_USER_INSTRUCTIONS_READER = userInstructionsReader({
  sourceKind: 'codex-user-instructions-section',
  nativeAgent: 'codex',
  idPrefix: 'codex:AGENTS.md',
  resolvePath: (environment) => join(resolveCodexSystemHome(environment), 'AGENTS.md')
})

function repoInstructionsReader(
  fileName: 'CLAUDE.md' | 'AGENTS.md',
  sourceKind: AgentMemorySourceKind,
  nativeAgent: AgentMemoryAgent
): AgentMemorySourceReader {
  return {
    sourceKind,
    // Read from the base ref only, so branch-only edits never reach the review queue.
    readWorkspace: async (_environment, workspace) => {
      const fileText = await workspace.readFileAtBaseRef(fileName)
      if (fileText === null) {
        return []
      }
      return sectionEntries({
        fileText,
        path: join(workspace.repoPath, fileName),
        idPrefix: `repo:${fileName}`,
        sourceKind,
        nativeAgent,
        modifiedAt: '',
        editable: false,
        reviewFilePath: join(workspace.repoPath, '.git', REPO_MEMORY_REVIEW_FILE_NAME)
      })
    }
  }
}

export const REPO_CLAUDE_MD_READER = repoInstructionsReader(
  'CLAUDE.md',
  'repo-claude-md-section',
  'claude'
)
export const REPO_AGENTS_MD_READER = repoInstructionsReader(
  'AGENTS.md',
  'repo-agents-md-section',
  'codex'
)
