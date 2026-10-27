import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  AGENT_MEMORY_AGENTS,
  AGENT_MEMORY_SUGGESTION_VERDICTS,
  AGENT_MEMORY_TYPES,
  type AgentMemoryDecision,
  type AgentMemoryItem
} from '../../../../../shared/agent-memory/agent-memory-types'
import {
  agentMemoryAgentLabel,
  agentMemoryDecisionLabel,
  agentMemoryReasonLabel,
  agentMemoryShareStateLabel,
  agentMemoryTypeLabel
} from './agent-memory-labels'
import {
  defaultShareAgents,
  keepDecisionFor,
  type AgentMemoryPanelState
} from './use-agent-memory-panel-state'

const REVIEW_FILTERS = ['all', 'unreviewed', 'reviewed'] as const
type ReviewFilter = (typeof REVIEW_FILTERS)[number]
const ANY = 'any'

function reviewFilterLabel(filter: ReviewFilter): string {
  switch (filter) {
    case 'all':
      return translate('agentMemory.list.filterAll', 'All')
    case 'unreviewed':
      return translate('agentMemory.list.filterUnreviewed', 'Unreviewed')
    case 'reviewed':
      return translate('agentMemory.list.filterReviewed', 'Reviewed')
  }
}

function FilterSelect({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="min-w-0 flex-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const SHARE_STATE_DOT: Record<
  AgentMemoryItem['shareStates'][keyof AgentMemoryItem['shareStates']],
  string
> = {
  native: 'bg-foreground',
  shared: 'bg-ring',
  paused: 'border border-ring',
  'not-shared': 'border border-border',
  unavailable: 'border border-dashed border-border opacity-50'
}

export function AgentMemoryListView({
  state
}: {
  state: AgentMemoryPanelState
}): React.JSX.Element {
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('unreviewed')
  const [typeFilter, setTypeFilter] = useState<string>(ANY)
  const [agentFilter, setAgentFilter] = useState<string>(ANY)
  const [suggestionFilter, setSuggestionFilter] = useState<string>(ANY)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const items = useMemo(() => state.listing?.items ?? [], [state.listing])
  const needle = query.trim().toLowerCase()
  const visible = items.filter(
    (item) =>
      (reviewFilter === 'all' ||
        (reviewFilter === 'unreviewed') === item.unreviewedReasons.length > 0) &&
      (typeFilter === ANY || item.type === typeFilter) &&
      (agentFilter === ANY || item.nativeAgent === agentFilter) &&
      (suggestionFilter === ANY || item.record?.suggestion?.verdict === suggestionFilter) &&
      (!needle || `${item.title}\n${item.description}\n${item.text}`.toLowerCase().includes(needle))
  )
  const selected = visible.filter((item) => selectedIds.has(item.id))

  const bulk = (decision: AgentMemoryDecision): void => {
    const linkable = state.listing?.linkableAgents ?? []
    const requests = selected.map((item) => {
      if (decision === 'KEEP') {
        const keep = keepDecisionFor(item)
        return state.buildRequest(item, keep.decision, keep.shares ? { shares: keep.shares } : {})
      }
      return decision === 'SHARE'
        ? state.buildRequest(item, 'SHARE', { shares: defaultShareAgents(item, linkable) })
        : state.buildRequest(item, decision)
    })
    void state.decide(requests).then(() => setSelectedIds(new Set()))
  }

  const toggle = (id: string): void =>
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={translate('agentMemory.list.search', 'Search memories')}
        aria-label={translate('agentMemory.list.search', 'Search memories')}
      />
      <div className="flex gap-1">
        <FilterSelect
          value={reviewFilter}
          onChange={(value) =>
            setReviewFilter(REVIEW_FILTERS.find((filter) => filter === value) ?? 'all')
          }
          options={REVIEW_FILTERS.map((filter) => ({
            value: filter,
            label: reviewFilterLabel(filter)
          }))}
        />
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: ANY, label: translate('agentMemory.list.anyType', 'Any type') },
            ...AGENT_MEMORY_TYPES.map((type) => ({
              value: type,
              label: agentMemoryTypeLabel(type)
            }))
          ]}
        />
        <FilterSelect
          value={agentFilter}
          onChange={setAgentFilter}
          options={[
            { value: ANY, label: translate('agentMemory.list.anyAgent', 'Any agent') },
            ...AGENT_MEMORY_AGENTS.map((agent) => ({
              value: agent,
              label: agentMemoryAgentLabel(agent)
            }))
          ]}
        />
        <FilterSelect
          value={suggestionFilter}
          onChange={setSuggestionFilter}
          options={[
            { value: ANY, label: translate('agentMemory.list.anySuggestion', 'Any suggestion') },
            ...AGENT_MEMORY_SUGGESTION_VERDICTS.map((verdict) => ({
              value: verdict,
              label: agentMemoryDecisionLabel(verdict)
            }))
          ]}
        />
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="mr-1 text-muted-foreground">
            {translate('agentMemory.list.selected', '{{value0}} selected', {
              value0: selected.length
            })}
          </span>
          {(['KEEP', 'SHARE', 'ARCHIVE', 'DELETE'] as const).map((decision) => (
            <Button
              key={decision}
              variant="outline"
              size="xs"
              disabled={state.busy}
              onClick={() => bulk(decision)}
            >
              {agentMemoryDecisionLabel(decision)}
            </Button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border px-1 pb-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        <Checkbox
          checked={visible.length > 0 && selected.length === visible.length}
          onCheckedChange={(checked) =>
            setSelectedIds(checked === true ? new Set(visible.map((item) => item.id)) : new Set())
          }
          aria-label={translate('agentMemory.list.selectAll', 'Select all')}
        />
        <span className="flex-1">{translate('agentMemory.list.memory', 'Memory')}</span>
        <span>{translate('agentMemory.list.sharing', 'Sharing')}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
        {visible.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            {translate('agentMemory.list.noMatches', 'No memories match these filters.')}
          </p>
        )}
        {visible.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-accent"
          >
            <Checkbox
              className="mt-0.5"
              checked={selectedIds.has(item.id)}
              onCheckedChange={() => toggle(item.id)}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{item.title}</div>
              <div className="truncate text-2xs text-muted-foreground">
                {agentMemoryTypeLabel(item.type)}
                {item.unreviewedReasons.length > 0 &&
                  ` · ${item.unreviewedReasons.map(agentMemoryReasonLabel).join(', ')}`}
                {item.record?.suggestion &&
                  ` · ${translate('agentMemory.list.suggested', 'suggests {{value0}}', {
                    value0: agentMemoryDecisionLabel(item.record.suggestion.verdict)
                  })}`}
                {item.locations.length > 1 &&
                  ` · ${translate('agentMemory.card.seenIn', 'seen in {{value0}} worktrees', { value0: item.locations.length })}`}
              </div>
            </div>
            <div className="flex shrink-0 gap-0.5 pt-1">
              {AGENT_MEMORY_AGENTS.map((agent) => (
                <span
                  key={agent}
                  title={`${agentMemoryAgentLabel(agent)}: ${agentMemoryShareStateLabel(item.shareStates[agent])}`}
                  className={cn('size-2 rounded-full', SHARE_STATE_DOT[item.shareStates[agent]])}
                />
              ))}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
