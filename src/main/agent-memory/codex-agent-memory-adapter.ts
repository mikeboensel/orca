import { join } from 'node:path'
import type { AgentMemoryTargetWarning } from '../../shared/agent-memory/agent-memory-sync-types'
import {
  AGENT_MEMORY_BLOCK_NOTICE,
  type AgentMemoryAdapterEnvironment,
  type AgentMemoryAgentAdapter
} from './agent-memory-agent-adapter'
import { readTextFileOrNull } from './agent-memory-file-io'

/** The system Codex home; Orca's managed Codex homes link its AGENTS.md. */
export function resolveCodexSystemHome(environment: AgentMemoryAdapterEnvironment): string {
  return join(environment.homeDirectory, '.codex')
}

export const CODEX_AGENT_MEMORY_ADAPTER: AgentMemoryAgentAdapter = {
  agent: 'codex',
  describeInstructionFile: async (environment) => {
    const codexHome = resolveCodexSystemHome(environment)
    const override = await readTextFileOrNull(join(codexHome, 'AGENTS.override.md'))
    const warnings: AgentMemoryTargetWarning[] =
      override !== null && override.trim().length > 0 ? ['codex-override-shadows-agents-md'] : []
    return { path: join(codexHome, 'AGENTS.md'), warnings }
  },
  // Codex has no import syntax; an imperative read instruction is followed reliably.
  renderLinkBlock: (links) => {
    const lines = ['## Orca agent memories', AGENT_MEMORY_BLOCK_NOTICE]
    if (links.globalPath) {
      lines.push(`- Before starting any task, read \`${links.globalPath}\` and follow it.`)
    }
    if (links.repos.length > 0) {
      lines.push(
        '- Before starting any task, run `git rev-parse --path-format=absolute --git-common-dir` in the working directory. This identifies the repo for its main checkout and every worktree:'
      )
      for (const repo of links.repos) {
        lines.push(
          `  - If it prints \`${repo.gitCommonDirectory}\` (repo ${repo.repoPath}), also read \`${repo.renderedPath}\` and follow it.`
        )
      }
    }
    return lines.join('\n')
  }
}
