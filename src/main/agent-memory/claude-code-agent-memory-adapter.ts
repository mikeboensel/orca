import { join } from 'node:path'
import {
  readUserClaudeConfigDir,
  resolveClaudeDefaultHome
} from '../claude-accounts/claude-profile-paths'
import {
  AGENT_MEMORY_BLOCK_NOTICE,
  type AgentMemoryAdapterEnvironment,
  type AgentMemoryAgentAdapter
} from './agent-memory-agent-adapter'

/** The user's own Claude home; Orca-injected account dirs import its CLAUDE.md. */
export function resolveClaudeCodeHome(environment: AgentMemoryAdapterEnvironment): string {
  return resolveClaudeDefaultHome(
    environment.homeDirectory,
    readUserClaudeConfigDir(environment.processEnvironment)
  )
}

/** Claude ends an @import at whitespace unless the space is backslash-escaped (verified on 2.1.311). */
export function claudeImportReference(path: string): string {
  return `@${path.replace(/ /g, '\\ ')}`
}

export const CLAUDE_CODE_AGENT_MEMORY_ADAPTER: AgentMemoryAgentAdapter = {
  agent: 'claude',
  describeInstructionFile: async (environment) => ({
    path: join(resolveClaudeCodeHome(environment), 'CLAUDE.md'),
    warnings: []
  }),
  renderLinkBlock: (links) => {
    const lines = ['## Orca agent memories', AGENT_MEMORY_BLOCK_NOTICE]
    if (links.globalPath) {
      lines.push(
        `Follow these memories in every project: ${claudeImportReference(links.globalPath)}`
      )
    }
    // Claude loads every @import up front; the condition tells it when the repo file applies.
    for (const repo of links.repos) {
      lines.push(
        `When working in ${repo.repoPath} or any of its git worktrees (\`git rev-parse --path-format=absolute --git-common-dir\` prints ${repo.gitCommonDirectory}), also follow: ${claudeImportReference(repo.renderedPath)}`
      )
    }
    return lines.join('\n')
  }
}
