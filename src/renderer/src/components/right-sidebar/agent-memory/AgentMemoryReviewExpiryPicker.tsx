import React, { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'

const EXPIRY_DAY_OPTIONS = [30, 60, 90, 180] as const
const OFF = 'off'

/** Off by default; when set, reviewed project memories return to the queue after that many days. */
export function AgentMemoryReviewExpiryPicker({
  onChanged
}: {
  onChanged: () => void
}): React.JSX.Element {
  const [days, setDays] = useState<number | null>(null)
  useEffect(() => {
    window.api.agentMemory
      .getPreferences()
      .then((preferences) => setDays(preferences.projectReviewExpiryDays))
      .catch(() => setDays(null))
  }, [])

  const select = (value: string): void => {
    const next = value === OFF ? null : Number(value)
    window.api.agentMemory
      .setPreferences({ projectReviewExpiryDays: next })
      .then((preferences) => {
        setDays(preferences.projectReviewExpiryDays)
        onChanged()
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error))
      )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('agentMemory.expiry.label', 'Re-review project memories')}
        >
          <Clock />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {translate('agentMemory.expiry.label', 'Re-review project memories')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={days === null ? OFF : String(days)} onValueChange={select}>
          <DropdownMenuRadioItem value={OFF}>
            {translate('agentMemory.expiry.off', 'Never')}
          </DropdownMenuRadioItem>
          {EXPIRY_DAY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option} value={String(option)}>
              {translate('agentMemory.expiry.days', 'After {{value0}} days', { value0: option })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
