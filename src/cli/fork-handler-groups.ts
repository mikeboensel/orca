import { AGENT_MEMORY_HANDLER_GROUP } from './agent-memory-handler-group'
import type { HandlerGroup } from './handler-group-manifest'
import { SETTINGS_HANDLER_GROUP } from './settings-handler-group'

// Fork-only command groups, kept here so the upstream manifest carries one hook line.
export const FORK_HANDLER_GROUPS: readonly HandlerGroup[] = [
  SETTINGS_HANDLER_GROUP,
  AGENT_MEMORY_HANDLER_GROUP
]
