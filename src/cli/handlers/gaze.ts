import type { CommandHandler } from '../dispatch'
import { RuntimeClientError } from '../runtime-client'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import type { GazePaneHit } from '../../shared/gaze-pane-contract'
import { followGazeProbe } from './gaze-follow'

function coordinate(flags: Map<string, string | boolean>, key: string): number {
  const value = Number(getRequiredStringFlag(flags, key))
  if (!Number.isFinite(value)) {
    throw new RuntimeClientError('invalid_argument', `--${key} must be a finite desktop point`)
  }
  return value
}

export const GAZE_HANDLERS: Record<string, CommandHandler> = {
  'gaze follow': async ({ client, json, flags }) => {
    await followGazeProbe(client, json, flags.has('debug'))
  },
  'gaze resolve': async ({ flags, client, json }) => {
    const result = await client.call<{ pane: GazePaneHit | null }>('gaze.resolve', {
      x: coordinate(flags, 'x'),
      y: coordinate(flags, 'y'),
      highlight: flags.has('highlight') || flags.has('debug'),
      debug: flags.has('debug')
    })
    printResult(result, json, ({ pane }) =>
      pane
        ? `${pane.contentType ?? 'unknown'} ${pane.worktreeId} group=${pane.groupId} tab=${pane.tabId ?? '-'} leaf=${pane.leafId ?? '-'} bounds=${pane.bounds.x},${pane.bounds.y} ${pane.bounds.width}x${pane.bounds.height}`
        : 'No Orca pane at that point'
    )
  },
  'gaze clear': async ({ client, json }) => {
    const result = await client.call<{ cleared: boolean }>('gaze.clear', {})
    printResult(result, json, () => 'Gaze highlight cleared')
  }
}
