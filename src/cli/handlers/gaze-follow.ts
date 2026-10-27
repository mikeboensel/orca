import type { RuntimeClient } from '../runtime-client'
import type { GazePaneHit } from '../../shared/gaze-pane-contract'
import { z } from 'zod'

const probeSnapshotSchema = z.object({
  state: z.string().optional(),
  timestamp: z.string().optional(),
  confidence: z.number().optional(),
  position: z
    .object({
      globalQuartzPoints: z
        .object({ x: z.number().optional(), y: z.number().optional() })
        .optional()
    })
    .optional()
})
type ProbeSnapshot = z.infer<typeof probeSnapshotSchema>

function snapshotFromEvent(block: string): ProbeSnapshot | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (!data) {
    return null
  }
  try {
    const parsed = probeSnapshotSchema.safeParse(JSON.parse(data))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function followGazeProbe(
  client: RuntimeClient,
  json: boolean,
  debug: boolean
): Promise<void> {
  const controller = new AbortController()
  let stopped = false
  let lastKey = ''
  let overlayActive = false
  const stop = (): void => {
    stopped = true
    controller.abort()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  const publish = async (snapshot: ProbeSnapshot): Promise<void> => {
    const point = snapshot.position?.globalQuartzPoints
    const tracked =
      snapshot.state === 'tracked' &&
      typeof point?.x === 'number' &&
      Number.isFinite(point.x) &&
      typeof point.y === 'number' &&
      Number.isFinite(point.y)
    const pane = tracked
      ? (
          await client.call<{ pane: GazePaneHit | null }>('gaze.resolve', {
            x: point.x,
            y: point.y,
            highlight: true,
            debug
          })
        ).result.pane
      : null
    if (tracked) {
      overlayActive = true
    } else if (overlayActive) {
      await client.call('gaze.clear', {})
      overlayActive = false
    }
    const key = pane ? `${pane.worktreeId}:${pane.groupId}:${pane.tabId}:${pane.leafId}` : '-'
    if (key === lastKey) {
      return
    }
    lastKey = key
    if (json) {
      console.log(
        JSON.stringify({
          timestamp: snapshot.timestamp,
          state: snapshot.state,
          confidence: snapshot.confidence ?? null,
          point: tracked ? point : null,
          pane
        })
      )
    } else {
      console.log(
        pane
          ? `${pane.contentType ?? 'unknown'}  group=${pane.groupId}  tab=${pane.tabId ?? '-'}  leaf=${pane.leafId ?? '-'}  confidence=${snapshot.confidence ?? '-'}`
          : 'No Orca pane in gaze'
      )
    }
  }

  try {
    while (!stopped) {
      try {
        const response = await fetch('http://127.0.0.1:48765/events', { signal: controller.signal })
        if (!response.ok || !response.body) {
          throw new Error(`Gaze Probe returned HTTP ${response.status}`)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!stopped) {
          const chunk = await reader.read()
          if (chunk.done) {
            break
          }
          buffer += decoder.decode(chunk.value, { stream: true })
          let boundary = buffer.search(/\r?\n\r?\n/)
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '')
            const snapshot = snapshotFromEvent(block)
            if (snapshot) {
              await publish(snapshot)
            }
            boundary = buffer.search(/\r?\n\r?\n/)
          }
          if (buffer.length > 1_000_000) {
            buffer = ''
          }
        }
      } catch (error) {
        if (stopped) {
          break
        }
        console.error(
          `Gaze Probe stream unavailable: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      if (overlayActive) {
        await client.call('gaze.clear', {}).catch(() => {})
        overlayActive = false
        lastKey = ''
      }
      if (!stopped) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await client.call('gaze.clear', {}).catch(() => {})
  }
}
