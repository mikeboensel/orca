import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  AgentMemoryDecisionPreview,
  AgentMemoryDecisionRequest,
  AgentMemoryListing,
  AgentMemoryScopeRequest
} from '../../../../../shared/agent-memory/agent-memory-review-types'
import type {
  AgentMemoryAgent,
  AgentMemoryDecision,
  AgentMemoryItem,
  AgentMemoryScopeKind
} from '../../../../../shared/agent-memory/agent-memory-types'
import { useAgentMemoryUnreviewedCountStore } from './agent-memory-unreviewed-count-store'

export const AGENT_MEMORY_PANEL_MODES = ['cards', 'list'] as const
export type AgentMemoryPanelMode = (typeof AGENT_MEMORY_PANEL_MODES)[number]

/** S shares with these; Gemini stays opt-in per memory so Orca never creates GEMINI.md unasked. */
const DEFAULT_SHARE_AGENTS: readonly AgentMemoryAgent[] = ['claude', 'codex']

/** Card decisions that change the agent's files wait in a batch the user confirms together. */
const QUEUED_CARD_DECISIONS: ReadonlySet<AgentMemoryDecision> = new Set([
  'ARCHIVE',
  'DELETE',
  'MERGE'
])

type UndoEntry = { kind: 'queued'; itemId: string } | { kind: 'applied'; undoId: string }

export type AgentMemoryPendingPreview = { preview: AgentMemoryDecisionPreview; fromQueue: boolean }

export type AgentMemoryDecisionExtras = {
  shares?: AgentMemoryAgent[]
  mergeTargetId?: string
  editedText?: string
}

/** Only a direct decision that touches nothing but Orca's own files, with nothing to warn about, skips the confirm. */
export function canApplyWithoutConfirm(pending: AgentMemoryPendingPreview): boolean {
  return (
    !pending.fromQueue &&
    pending.preview.warnings.length === 0 &&
    pending.preview.fileChanges.every((change) => change.owner === 'orca')
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function defaultShareAgents(
  item: AgentMemoryItem,
  linkable: readonly AgentMemoryAgent[]
): AgentMemoryAgent[] {
  return DEFAULT_SHARE_AGENTS.filter(
    (agent) => agent !== item.nativeAgent && linkable.includes(agent)
  )
}

/** Keeping a shared memory keeps its shares. */
export function keepDecisionFor(item: AgentMemoryItem): {
  decision: AgentMemoryDecision
  shares?: AgentMemoryAgent[]
} {
  const shares = item.record?.shares ?? []
  return shares.length > 0 ? { decision: 'SHARE', shares } : { decision: 'KEEP' }
}

export function useAgentMemoryPanelState(repoPath: string | null) {
  const [scopeKind, setScopeKind] = useState<AgentMemoryScopeKind>(
    repoPath ? 'workspace' : 'global'
  )
  const [mode, setMode] = useState<AgentMemoryPanelMode>('cards')
  const scope = useMemo<AgentMemoryScopeRequest>(
    () =>
      scopeKind === 'workspace' && repoPath ? { kind: 'workspace', repoPath } : { kind: 'global' },
    [repoPath, scopeKind]
  )
  const [listing, setListing] = useState<AgentMemoryListing | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [queued, setQueued] = useState<AgentMemoryDecisionRequest[]>([])
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<string>>(new Set())
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [pendingPreview, setPendingPreview] = useState<AgentMemoryPendingPreview | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await window.api.agentMemory.list(scope)
      setListing(next)
      setLoadError(null)
      if (next.scope.kind === 'workspace') {
        useAgentMemoryUnreviewedCountStore
          .getState()
          .setCount(next.scope.repoPath, next.unreviewedCount)
      }
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    setListing(null)
    setQueued([])
    setSkippedIds(new Set())
    setUndoStack([])
    void refresh()
  }, [refresh])

  const buildRequest = useCallback(
    (
      item: AgentMemoryItem,
      decision: AgentMemoryDecision,
      extras: AgentMemoryDecisionExtras = {}
    ): AgentMemoryDecisionRequest => ({
      scope,
      itemId: item.id,
      contentHash: item.contentHash,
      decision,
      ...extras
    }),
    [scope]
  )

  const applyPreview = useCallback(
    async (pending: AgentMemoryPendingPreview) => {
      setBusy(true)
      try {
        const result = await window.api.agentMemory.applyDecisions({
          requests: pending.preview.requests,
          previewFingerprint: pending.preview.previewFingerprint
        })
        if (result.undoId) {
          const undoId = result.undoId
          setUndoStack((stack) => [...stack, { kind: 'applied', undoId }])
        }
        if (pending.fromQueue) {
          setQueued([])
        }
        setPendingPreview(null)
        await refresh()
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setBusy(false)
      }
    },
    [refresh]
  )

  /** Applies at once when only Orca's own files change; anything touching agent files asks first. */
  const decide = useCallback(
    async (requests: AgentMemoryDecisionRequest[], fromQueue = false) => {
      if (requests.length === 0) {
        return
      }
      setBusy(true)
      try {
        const preview = await window.api.agentMemory.previewDecisions(requests)
        for (const rejection of preview.rejected) {
          toast.error(rejection.reason)
        }
        if (preview.requests.length === 0) {
          return
        }
        const pending = { preview, fromQueue }
        if (canApplyWithoutConfirm(pending)) {
          await applyPreview(pending)
        } else {
          setPendingPreview(pending)
        }
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setBusy(false)
      }
    },
    [applyPreview]
  )

  const decideCard = useCallback(
    (item: AgentMemoryItem, decision: AgentMemoryDecision, extras?: AgentMemoryDecisionExtras) => {
      if (QUEUED_CARD_DECISIONS.has(decision)) {
        setQueued((current) => [...current, buildRequest(item, decision, extras)])
        setUndoStack((stack) => [...stack, { kind: 'queued', itemId: item.id }])
        return
      }
      void decide([buildRequest(item, decision, extras)])
    },
    [buildRequest, decide]
  )

  const undo = useCallback(async () => {
    const last = undoStack.at(-1)
    if (!last) {
      return
    }
    setUndoStack((stack) => stack.slice(0, -1))
    if (last.kind === 'queued') {
      setQueued((current) => current.filter((request) => request.itemId !== last.itemId))
      return
    }
    setBusy(true)
    try {
      const result = await window.api.agentMemory.undo(last.undoId)
      toast.success(
        translate('agentMemory.panel.undone', 'Restored {{value0}} file(s)', {
          value0: result.restoredFiles.length
        })
      )
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }, [refresh, undoStack])

  const skip = useCallback((itemId: string) => {
    setSkippedIds((current) => new Set([...current, itemId]))
  }, [])

  const queuedIds = useMemo(() => new Set(queued.map((request) => request.itemId)), [queued])
  const reviewQueue = useMemo(
    () =>
      (listing?.items ?? []).filter(
        (item) =>
          item.unreviewedReasons.length > 0 && !queuedIds.has(item.id) && !skippedIds.has(item.id)
      ),
    [listing, queuedIds, skippedIds]
  )

  return {
    scopeKind,
    setScopeKind,
    canUseWorkspace: repoPath !== null,
    mode,
    setMode,
    listing,
    loading,
    loadError,
    busy,
    refresh,
    queued,
    reviewQueue,
    skip,
    undo,
    canUndo: undoStack.length > 0,
    buildRequest,
    decide,
    decideCard,
    pendingPreview,
    applyPreview,
    dismissPreview: () => setPendingPreview(null),
    reviewQueued: () => void decide(queued, true),
    resetSkipped: () => setSkippedIds(new Set())
  }
}

export type AgentMemoryPanelState = ReturnType<typeof useAgentMemoryPanelState>
