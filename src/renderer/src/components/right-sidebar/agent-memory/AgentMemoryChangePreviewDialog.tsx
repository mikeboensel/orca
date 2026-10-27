import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import type {
  AgentMemoryFileChange,
  AgentMemoryFileChangeOwner
} from '../../../../../shared/agent-memory/agent-memory-review-types'
import { agentMemoryDecisionLabel } from './agent-memory-labels'
import type { AgentMemoryPanelState } from './use-agent-memory-panel-state'

function ownerLabel(owner: AgentMemoryFileChangeOwner): string {
  switch (owner) {
    case 'orca':
      return translate('agentMemory.preview.ownerOrca', 'Orca shared file')
    case 'memory-source':
      return translate('agentMemory.preview.ownerSource', 'Agent memory')
    case 'agent-link-block':
      return translate('agentMemory.preview.ownerLinkBlock', 'Orca block in agent file')
  }
}

function changeSummary(change: AgentMemoryFileChange): string {
  switch (change.kind) {
    case 'move':
      return translate('agentMemory.preview.move', 'Move to {{value0}}', {
        value0: change.toPath ?? ''
      })
    case 'delete':
      return translate('agentMemory.preview.delete', 'Delete')
    case 'write':
      return change.beforeText === null
        ? translate('agentMemory.preview.create', 'Create')
        : translate('agentMemory.preview.write', 'Rewrite')
  }
}

/** Line-level view of a rewrite: enough to see which lines a decision adds or drops. */
function changedLines(change: AgentMemoryFileChange): string[] {
  if (change.kind !== 'write') {
    return []
  }
  const before = (change.beforeText ?? '').split('\n')
  const after = (change.afterText ?? '').split('\n')
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return [
    ...before.filter((line) => line.trim() && !afterSet.has(line)).map((line) => `- ${line}`),
    ...after.filter((line) => line.trim() && !beforeSet.has(line)).map((line) => `+ ${line}`)
  ].slice(0, 40)
}

export function AgentMemoryChangePreviewDialog({
  state
}: {
  state: AgentMemoryPanelState
}): React.JSX.Element | null {
  const pending = state.pendingPreview
  if (!pending) {
    return null
  }
  const { preview } = pending
  const decisions = preview.requests.map((request) => agentMemoryDecisionLabel(request.decision))
  return (
    <Dialog open onOpenChange={(open) => !open && state.dismissPreview()}>
      <DialogContent surface="security" scrollable className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {translate('agentMemory.preview.title', 'Apply {{value0}} memory decision(s)?', {
              value0: preview.requests.length
            })}
          </DialogTitle>
          <DialogDescription>
            {preview.fileChanges.length === 0
              ? translate(
                  'agentMemory.preview.recordOnly',
                  'Only the review record changes: {{value0}}.',
                  {
                    value0: decisions.join(', ')
                  }
                )
              : translate(
                  'agentMemory.preview.description',
                  'These files change exactly as listed. Undo restores them while nothing else edits them.'
                )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {preview.fileChanges.map((change) => (
            <div
              key={`${change.kind}:${change.path}:${change.toPath ?? ''}:${change.afterText?.length ?? -1}`}
              className="rounded-md border border-border p-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{changeSummary(change)}</span>
                <span className="text-muted-foreground">{ownerLabel(change.owner)}</span>
              </div>
              <div className="font-mono text-2xs break-all text-muted-foreground">
                {change.path}
              </div>
              {changedLines(change).length > 0 && (
                <pre className="mt-1 max-h-40 overflow-auto font-mono text-2xs whitespace-pre-wrap scrollbar-sleek">
                  {changedLines(change).join('\n')}
                </pre>
              )}
            </div>
          ))}
          {preview.warnings.map((warning) => (
            <p key={warning} className="text-xs text-muted-foreground">
              {warning}
            </p>
          ))}
          {preview.rejected.map((rejection) => (
            <p key={rejection.itemId} className="text-xs text-destructive">
              {`${rejection.itemId}: ${rejection.reason}`}
            </p>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={state.dismissPreview}>
            {translate('agentMemory.preview.cancel', 'Cancel')}
          </Button>
          <Button disabled={state.busy} onClick={() => void state.applyPreview(pending)}>
            {translate('agentMemory.preview.apply', 'Apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
