import { join } from 'node:path'
import {
  AGENT_MEMORY_BLOCK_NOTICE,
  type AgentMemoryAgentAdapter
} from './agent-memory-agent-adapter'

/** Gemini CLI loads ~/.gemini/GEMINI.md globally; the same read instructions as Codex keep paths with spaces safe. */
export const GEMINI_AGENT_MEMORY_ADAPTER: AgentMemoryAgentAdapter = {
  agent: 'gemini',
  describeInstructionFile: async (environment) => ({
    path: join(environment.homeDirectory, '.gemini', 'GEMINI.md'),
    warnings: []
  }),
  renderLinkBlock: (links) => {
    const lines = ['## Orca agent memories', AGENT_MEMORY_BLOCK_NOTICE]
    if (links.globalPath) {
      lines.push(`- Before starting any task, read \`${links.globalPath}\` and follow it.`)
    }
    for (const repo of links.repos) {
      lines.push(
        `- If \`git rev-parse --path-format=absolute --git-common-dir\` prints \`${repo.gitCommonDirectory}\` (repo ${repo.repoPath} or one of its worktrees), also read \`${repo.renderedPath}\` and follow it.`
      )
    }
    return lines.join('\n')
  }
}
