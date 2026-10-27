import React, { useMemo } from 'react'
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID
} from '../../../../../shared/execution-host'
import type { Repo } from '../../../../../shared/repo-types'
import type { ActivityBarItem } from '../activity-bar-buttons'
import { useAgentMemoryUnreviewedCount } from './agent-memory-unreviewed-count-store'

type ActivityIcon = ActivityBarItem['icon']

/** Brain with the unreviewed count; the activity button is `relative`, so the badge anchors to it. */
function agentMemoryTabIcon(count: number | null): ActivityIcon {
  function AgentMemoryTabIcon({
    size,
    className
  }: {
    size?: number
    className?: string
  }): React.JSX.Element {
    return (
      <>
        <Brain size={size} className={className} />
        {count ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-secondary px-0.5 text-3xs leading-none font-medium text-foreground ring-1 ring-sidebar',
              size === 16 ? 'top-[4px] right-[1px]' : 'top-[3px] right-[3px]'
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </>
    )
  }
  return AgentMemoryTabIcon
}

/** The Memory tab, or null for workspaces whose files live on another host. */
export function useAgentMemoryActivityItem(activeRepo: Repo | null): ActivityBarItem | null {
  // Folder workspaces have no single repo; their Memory tab shows global memory only.
  const hasLocalFiles = activeRepo
    ? getRepoExecutionHostId(activeRepo) === LOCAL_EXECUTION_HOST_ID
    : true
  const count = useAgentMemoryUnreviewedCount(hasLocalFiles && activeRepo ? activeRepo.path : null)
  const icon = useMemo(() => agentMemoryTabIcon(count), [count])
  return useMemo(() => {
    if (!hasLocalFiles) {
      return null
    }
    const title = translate('agentMemory.panel.tabTitle', 'Memory')
    return {
      id: 'memory',
      icon,
      title: count
        ? translate('agentMemory.panel.tabTitleWithCount', 'Memory ({{value0}} unreviewed)', {
            value0: count
          })
        : title,
      shortcut: ''
    }
  }, [count, hasLocalFiles, icon])
}
