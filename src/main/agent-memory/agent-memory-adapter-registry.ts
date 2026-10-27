import type { AgentMemoryAgent } from '../../shared/agent-memory/agent-memory-types'
import type { AgentMemoryAgentAdapter } from './agent-memory-agent-adapter'
import { CLAUDE_CODE_AGENT_MEMORY_ADAPTER } from './claude-code-agent-memory-adapter'
import { CODEX_AGENT_MEMORY_ADAPTER } from './codex-agent-memory-adapter'
import { GEMINI_AGENT_MEMORY_ADAPTER } from './gemini-agent-memory-adapter'

/**
 * Agents memories can be shared to. OpenCode is left out: creating ~/.config/opencode/AGENTS.md
 * turns off its ~/.claude/CLAUDE.md fallback. Pi's global instruction file is not confirmed.
 */
export const AGENT_MEMORY_LINK_ADAPTERS: Partial<
  Record<AgentMemoryAgent, AgentMemoryAgentAdapter>
> = {
  claude: CLAUDE_CODE_AGENT_MEMORY_ADAPTER,
  codex: CODEX_AGENT_MEMORY_ADAPTER,
  gemini: GEMINI_AGENT_MEMORY_ADAPTER
}

export function agentMemoryLinkAdapters(): AgentMemoryAgentAdapter[] {
  return Object.values(AGENT_MEMORY_LINK_ADAPTERS).filter(
    (adapter): adapter is AgentMemoryAgentAdapter => adapter !== undefined
  )
}
