import type { HandlerGroup } from './handler-group-manifest'

export const AGENT_MEMORY_HANDLER_GROUP: HandlerGroup = {
  name: 'agent-memory',
  keys: [
    'agent-memory list',
    'agent-memory show',
    'agent-memory history',
    'agent-memory suggest',
    'agent-memory add',
    'agent-memory edit',
    'agent-memory review',
    'agent-memory undo',
    'agent-memory sync'
  ],
  load: async () => (await import('./handlers/agent-memory.js')).AGENT_MEMORY_HANDLERS
}
