import React from 'react'
import { useAppStore } from '@/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { firstRecapLine, selectActiveTabRecap, selectActiveTabTitle } from './active-tab-summary'

export function ActiveTabSummarySegment(): React.JSX.Element | null {
  const title = useAppStore(selectActiveTabTitle)
  const recap = useAppStore(selectActiveTabRecap)
  const recapLine = firstRecapLine(recap)
  if (!title && !recapLine) {
    return null
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="min-w-0 flex-1 truncate px-3 text-center text-muted-foreground">
          {title ? <span className="text-foreground">{title}</span> : null}
          {title && recapLine ? <span aria-hidden> · </span> : null}
          {recapLine}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} variant="tab-preview">
        {title ? <div className="font-medium">{title}</div> : null}
        {recap ? (
          <div className="mt-1 line-clamp-[12] whitespace-pre-wrap text-muted-foreground">
            {recap}
          </div>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
