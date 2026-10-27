import { useEffect } from 'react'
import { create } from 'zustand'

type AgentMemoryUnreviewedCountState = {
  /** Unreviewed workspace memories by main checkout path; the panel refreshes it after each listing. */
  countsByRepoPath: Record<string, number>
  setCount: (repoPath: string, count: number) => void
}

export const useAgentMemoryUnreviewedCountStore = create<AgentMemoryUnreviewedCountState>(
  (set) => ({
    countsByRepoPath: {},
    setCount: (repoPath, count) =>
      set((state) =>
        state.countsByRepoPath[repoPath] === count
          ? state
          : { countsByRepoPath: { ...state.countsByRepoPath, [repoPath]: count } }
      )
  })
)

const requestedRepoPaths = new Set<string>()

/** Badge count for the Memory tab; lists the workspace once per session if the panel has not yet. */
export function useAgentMemoryUnreviewedCount(repoPath: string | null): number | null {
  const count = useAgentMemoryUnreviewedCountStore((state) =>
    repoPath ? state.countsByRepoPath[repoPath] : undefined
  )
  useEffect(() => {
    if (!repoPath || requestedRepoPaths.has(repoPath)) {
      return
    }
    requestedRepoPaths.add(repoPath)
    window.api.agentMemory
      .list({ kind: 'workspace', repoPath })
      .then((listing) =>
        useAgentMemoryUnreviewedCountStore.getState().setCount(repoPath, listing.unreviewedCount)
      )
      .catch(() => {
        // A badge is optional chrome; the panel shows the error when opened.
        requestedRepoPaths.delete(repoPath)
      })
  }, [repoPath])
  return count ?? null
}
