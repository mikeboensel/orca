import React, { useEffect, useRef, useState } from 'react'
import { Lightbulb, TriangleAlert } from 'lucide-react'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { isEditableTarget } from '@/lib/editable-target'
import type { AgentMemoryItem } from '../../../../../shared/agent-memory/agent-memory-types'
import {
  agentMemoryAgentLabel,
  agentMemoryDecisionLabel,
  agentMemoryReasonLabel,
  agentMemoryTypeLabel,
  formatAgentMemoryAge
} from './agent-memory-labels'
import { AgentMemorySharingChips, toggledShares } from './AgentMemorySharingChips'
import {
  defaultShareAgents,
  keepDecisionFor,
  type AgentMemoryPanelState
} from './use-agent-memory-panel-state'

type CardEditor =
  | { kind: 'none' }
  | { kind: 'edit'; text: string }
  | { kind: 'merge'; targetId: string }

function CardActionButton({
  keyLabel,
  label,
  onClick,
  disabled
}: {
  keyLabel: string
  label: string
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Button variant="outline" size="xs" onClick={onClick} disabled={disabled}>
      <ShortcutKeyCombo keys={[keyLabel]} keyCapClassName="min-w-4 px-1 py-0 text-2xs" />
      {label}
    </Button>
  )
}

export function AgentMemoryReviewCard({
  item,
  remaining,
  state
}: {
  item: AgentMemoryItem
  remaining: number
  state: AgentMemoryPanelState
}): React.JSX.Element {
  const [editor, setEditor] = useState<CardEditor>({ kind: 'none' })
  // Ages are relative to when the card mounted; a render-time clock would be impure.
  const [loadedAt] = useState(() => Date.now())
  const containerRef = useRef<HTMLDivElement>(null)
  const linkable = state.listing?.linkableAgents ?? []
  const mergeTargets = (state.listing?.items ?? []).filter(
    (candidate) =>
      candidate.id !== item.id && candidate.editable && candidate.type !== 'instruction'
  )

  // The parent remounts this card per memory (key = id), so focus once on mount.
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true })
  }, [])

  const keep = (): void => {
    const { decision, shares } = keepDecisionFor(item)
    state.decideCard(item, decision, shares ? { shares } : {})
  }
  const share = (): void => {
    const shares = item.record?.shares.length
      ? item.record.shares
      : defaultShareAgents(item, linkable)
    state.decideCard(item, 'SHARE', { shares })
  }
  const startEdit = (): void => {
    if (item.editable) {
      setEditor({ kind: 'edit', text: item.text })
    }
  }
  const startMerge = (): void => {
    if (mergeTargets.length > 0) {
      setEditor({
        kind: 'merge',
        targetId: item.record?.suggestion?.mergeTarget ?? mergeTargets[0].id
      })
    }
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (
      editor.kind !== 'none' ||
      isEditableTarget(event.target) ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      state.busy
    ) {
      return
    }
    const actions: Record<string, () => void> = {
      ArrowLeft: () => state.decideCard(item, 'ARCHIVE'),
      ArrowRight: keep,
      ArrowUp: startEdit,
      ArrowDown: () => state.skip(item.id),
      s: share,
      m: startMerge,
      z: () => void state.undo()
    }
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (action && !event.repeat) {
      event.preventDefault()
      action()
    }
  }

  const suggestion = item.record?.suggestion
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-label={translate('agentMemory.card.label', 'Memory review card: {{value0}}', {
        value0: item.title
      })}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="truncate text-xs text-muted-foreground">{item.description}</div>
        </div>
        <span className="shrink-0 text-2xs text-muted-foreground">
          {translate('agentMemory.card.remaining', '{{value0}} left', { value0: remaining })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-2xs text-muted-foreground">
        <Badge variant="outline">{agentMemoryTypeLabel(item.type)}</Badge>
        <Badge variant="outline">{agentMemoryAgentLabel(item.nativeAgent)}</Badge>
        <span>{formatAgentMemoryAge(item.modifiedAt, loadedAt)}</span>
        <span>·</span>
        <span>
          {translate('agentMemory.card.size', '{{value0}} B', { value0: item.sizeBytes })}
        </span>
        {item.locations.length > 1 && (
          <>
            <span>·</span>
            <span>
              {translate('agentMemory.card.seenIn', 'seen in {{value0}} worktrees', {
                value0: item.locations.length
              })}
            </span>
          </>
        )}
      </div>
      {suggestion && (
        <div className="flex gap-1.5 rounded-md border border-border bg-muted/40 p-2 text-xs">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div>
            <span className="font-medium">
              {translate('agentMemory.card.suggestion', 'Suggested: {{value0}}', {
                value0: agentMemoryDecisionLabel(suggestion.verdict)
              })}
            </span>
            <span className="text-muted-foreground">
              {' '}
              {translate('agentMemory.card.suggestedBy', 'by {{value0}}', {
                value0: suggestion.by
              })}
            </span>
            {suggestion.reason && <div className="text-muted-foreground">{suggestion.reason}</div>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1 text-2xs">
        {item.unreviewedReasons.map((reason) => (
          <Badge key={reason} variant="secondary">
            {agentMemoryReasonLabel(reason)}
          </Badge>
        ))}
      </div>
      {item.staleFindings.map((finding) => (
        <div key={finding.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="size-3.5 shrink-0" />
          {finding.detail}
        </div>
      ))}
      {editor.kind === 'edit' ? (
        <Textarea
          autoFocus
          value={editor.text}
          onChange={(event) => setEditor({ kind: 'edit', text: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setEditor({ kind: 'none' })
            } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              state.decideCard(item, 'EDIT', { editedText: editor.text })
            }
          }}
          variant="code"
          className="min-h-40 flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-xs scrollbar-sleek">
          {item.text}
        </div>
      )}
      {editor.kind === 'merge' && (
        <div className="flex items-center gap-2">
          <Select
            value={editor.targetId}
            onValueChange={(targetId) => setEditor({ kind: 'merge', targetId })}
          >
            <SelectTrigger size="sm" className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mergeTargets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="xs"
            onClick={() => state.decideCard(item, 'MERGE', { mergeTargetId: editor.targetId })}
          >
            {translate('agentMemory.card.mergeInto', 'Merge into')}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setEditor({ kind: 'none' })}>
            {translate('agentMemory.card.cancel', 'Cancel')}
          </Button>
        </div>
      )}
      {editor.kind === 'edit' && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="xs" onClick={() => setEditor({ kind: 'none' })}>
            {translate('agentMemory.card.cancel', 'Cancel')}
          </Button>
          <Button
            size="xs"
            onClick={() => state.decideCard(item, 'EDIT', { editedText: editor.text })}
          >
            {translate('agentMemory.card.saveEdit', 'Save to source file')}
          </Button>
        </div>
      )}
      <AgentMemorySharingChips
        item={item}
        disabled={state.busy}
        onToggle={(agent) => {
          const shares = toggledShares(item, agent)
          state.decideCard(item, shares.length > 0 ? 'SHARE' : 'KEEP', { shares })
        }}
      />
      {editor.kind === 'none' && (
        <div className="flex flex-wrap gap-1">
          <CardActionButton
            keyLabel="←"
            label={agentMemoryDecisionLabel('ARCHIVE')}
            onClick={() => state.decideCard(item, 'ARCHIVE')}
          />
          <CardActionButton keyLabel="→" label={agentMemoryDecisionLabel('KEEP')} onClick={keep} />
          <CardActionButton
            keyLabel="S"
            label={agentMemoryDecisionLabel('SHARE')}
            onClick={share}
          />
          <CardActionButton
            keyLabel="↑"
            label={agentMemoryDecisionLabel('EDIT')}
            onClick={startEdit}
            disabled={!item.editable}
          />
          <CardActionButton
            keyLabel="M"
            label={agentMemoryDecisionLabel('MERGE')}
            onClick={startMerge}
            disabled={mergeTargets.length === 0}
          />
          <CardActionButton
            keyLabel="↓"
            label={translate('agentMemory.card.skip', 'Skip')}
            onClick={() => state.skip(item.id)}
          />
          <CardActionButton
            keyLabel="Z"
            label={translate('agentMemory.card.undo', 'Undo')}
            onClick={() => void state.undo()}
            disabled={!state.canUndo}
          />
        </div>
      )}
    </div>
  )
}
