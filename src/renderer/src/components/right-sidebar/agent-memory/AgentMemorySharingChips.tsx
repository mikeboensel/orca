import React from 'react'
import { Check, Link2, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AGENT_MEMORY_AGENTS,
  type AgentMemoryAgent,
  type AgentMemoryItem
} from '../../../../../shared/agent-memory/agent-memory-types'
import { agentMemoryAgentLabel, agentMemoryShareStateLabel } from './agent-memory-labels'

/** One chip per agent: native (the agent wrote it), shared, not shared, or not supported yet. */
export function AgentMemorySharingChips({
  item,
  disabled,
  onToggle
}: {
  item: AgentMemoryItem
  disabled: boolean
  onToggle: (agent: AgentMemoryAgent) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {AGENT_MEMORY_AGENTS.map((agent) => {
        const state = item.shareStates[agent]
        const clickable = state === 'shared' || state === 'paused' || state === 'not-shared'
        return (
          <Tooltip key={agent}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled || !clickable}
                aria-pressed={state === 'shared'}
                onClick={() => onToggle(agent)}
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-2xs transition-colors',
                  state === 'native' && 'border-border bg-secondary text-foreground',
                  state === 'shared' && 'border-ring/60 bg-accent text-foreground',
                  state === 'paused' && 'border-dashed border-ring/60 text-muted-foreground',
                  state === 'not-shared' && 'border-border text-muted-foreground hover:bg-accent',
                  state === 'unavailable' && 'border-dashed border-border text-muted-foreground/50',
                  clickable && !disabled && 'cursor-pointer'
                )}
              >
                {state === 'native' && <Check className="size-3" />}
                {state === 'shared' && <Link2 className="size-3" />}
                {state === 'paused' && <Pause className="size-3" />}
                {agentMemoryAgentLabel(agent)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {agentMemoryShareStateLabel(state)}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

/** Next share list after toggling one agent. */
export function toggledShares(item: AgentMemoryItem, agent: AgentMemoryAgent): AgentMemoryAgent[] {
  const current = item.record?.shares ?? []
  return current.includes(agent) ? current.filter((entry) => entry !== agent) : [...current, agent]
}
