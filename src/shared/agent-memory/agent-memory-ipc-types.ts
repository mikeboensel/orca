import type {
  AgentMemoryApplyDecisionsRequest,
  AgentMemoryDecisionPreview,
  AgentMemoryDecisionRequest,
  AgentMemoryDecisionResult,
  AgentMemoryListing,
  AgentMemoryPreferences,
  AgentMemoryScopeRequest,
  AgentMemoryUndoResult
} from './agent-memory-review-types'

/** Renderer API; suggestions are CLI-only because only agents make them. */
export type AgentMemoryApi = {
  list: (scope: AgentMemoryScopeRequest) => Promise<AgentMemoryListing>
  previewDecisions: (requests: AgentMemoryDecisionRequest[]) => Promise<AgentMemoryDecisionPreview>
  applyDecisions: (request: AgentMemoryApplyDecisionsRequest) => Promise<AgentMemoryDecisionResult>
  undo: (undoId: string) => Promise<AgentMemoryUndoResult>
  getPreferences: () => Promise<AgentMemoryPreferences>
  setPreferences: (preferences: AgentMemoryPreferences) => Promise<AgentMemoryPreferences>
}
