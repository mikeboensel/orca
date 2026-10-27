import { ipcRenderer } from 'electron'
import type { AgentMemoryApi } from '../../shared/agent-memory/agent-memory-ipc-types'

export const agentMemoryApi = {
  list: (scope) => ipcRenderer.invoke('agentMemory:list', scope),
  previewDecisions: (requests) => ipcRenderer.invoke('agentMemory:previewDecisions', requests),
  applyDecisions: (request) => ipcRenderer.invoke('agentMemory:applyDecisions', request),
  undo: (undoId) => ipcRenderer.invoke('agentMemory:undo', undoId),
  getPreferences: () => ipcRenderer.invoke('agentMemory:getPreferences'),
  setPreferences: (preferences) => ipcRenderer.invoke('agentMemory:setPreferences', preferences)
} satisfies AgentMemoryApi
