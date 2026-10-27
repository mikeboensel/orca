import React from 'react'
import { Brain, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { useActiveWorktree, useRepoById } from '@/store/selectors'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { AgentMemoryChangePreviewDialog } from './agent-memory/AgentMemoryChangePreviewDialog'
import { AgentMemoryListView } from './agent-memory/AgentMemoryListView'
import { AgentMemoryReviewCard } from './agent-memory/AgentMemoryReviewCard'
import { AgentMemoryReviewExpiryPicker } from './agent-memory/AgentMemoryReviewExpiryPicker'
import {
  AGENT_MEMORY_PANEL_MODES,
  useAgentMemoryPanelState,
  type AgentMemoryPanelState
} from './agent-memory/use-agent-memory-panel-state'

/** Workspace memory needs the repo's files on this machine; remote workspaces get Global only. */
export function useAgentMemoryWorkspaceRepoPath(): string | null {
  const worktree = useActiveWorktree()
  const repo = useRepoById(worktree?.repoId ?? null)
  return repo && getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID ? repo.path : null
}

function CardsMode({ state }: { state: AgentMemoryPanelState }): React.JSX.Element {
  const current = state.reviewQueue[0]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {state.queued.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
          <span>
            {translate('agentMemory.panel.queued', '{{value0}} file change(s) waiting', {
              value0: state.queued.length
            })}
          </span>
          <Button size="xs" disabled={state.busy} onClick={state.reviewQueued}>
            {translate('agentMemory.panel.reviewQueued', 'Review and apply')}
          </Button>
        </div>
      )}
      {current ? (
        <AgentMemoryReviewCard
          key={current.id}
          item={current}
          remaining={state.reviewQueue.length}
          state={state}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          <Brain className="size-8 opacity-50" />
          <p className="text-sm">
            {translate('agentMemory.panel.allReviewed', 'Nothing left to review here.')}
          </p>
          <Button variant="ghost" size="xs" onClick={state.resetSkipped}>
            {translate('agentMemory.panel.showSkipped', 'Show skipped')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AgentMemoryPanel(): React.JSX.Element {
  const repoPath = useAgentMemoryWorkspaceRepoPath()
  const state = useAgentMemoryPanelState(repoPath)
  const listing = state.listing
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex items-center gap-1">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={state.scopeKind}
          onValueChange={(value) => {
            if (value === 'workspace' || value === 'global') {
              state.setScopeKind(value)
            }
          }}
          aria-label={translate('agentMemory.panel.scope', 'Memory scope')}
        >
          <ToggleGroupItem value="workspace" disabled={!state.canUseWorkspace}>
            {translate('agentMemory.panel.workspace', 'This workspace')}
          </ToggleGroupItem>
          <ToggleGroupItem value="global">
            {translate('agentMemory.panel.global', 'Global')}
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex-1" />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={state.mode}
          onValueChange={(value) => {
            const mode = AGENT_MEMORY_PANEL_MODES.find((candidate) => candidate === value)
            if (mode) {
              state.setMode(mode)
            }
          }}
          aria-label={translate('agentMemory.panel.mode', 'View')}
        >
          <ToggleGroupItem value="cards">
            {translate('agentMemory.panel.cards', 'Cards')}
          </ToggleGroupItem>
          <ToggleGroupItem value="list">
            {translate('agentMemory.panel.list', 'List')}
          </ToggleGroupItem>
        </ToggleGroup>
        <AgentMemoryReviewExpiryPicker onChanged={() => void state.refresh()} />
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={state.loading}
          onClick={() => void state.refresh()}
          aria-label={translate('agentMemory.panel.refresh', 'Refresh')}
        >
          {state.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>
      {listing && (
        <div className="text-2xs text-muted-foreground">
          {translate('agentMemory.panel.summary', '{{value0}} memories · {{value1}} unreviewed', {
            value0: listing.items.length,
            value1: listing.unreviewedCount
          })}
          {listing.baseRef &&
            ` · ${translate('agentMemory.panel.baseRef', 'repo files from {{value0}}', { value0: listing.baseRef })}`}
        </div>
      )}
      {state.loadError && <p className="text-xs text-destructive">{state.loadError}</p>}
      {listing?.warnings.map((warning) => (
        <p key={warning} className="text-2xs text-muted-foreground">
          {warning}
        </p>
      ))}
      {!listing && !state.loadError ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : state.mode === 'cards' ? (
        <CardsMode state={state} />
      ) : (
        <AgentMemoryListView state={state} />
      )}
      <AgentMemoryChangePreviewDialog state={state} />
    </div>
  )
}
