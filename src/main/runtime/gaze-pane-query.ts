import { randomUUID } from 'node:crypto'
import type { IpcMainEvent } from 'electron'
import type { OrcaRuntimeService } from './orca-runtime'
import { getRuntimeDesktopSurface } from './runtime-desktop-surface'
import type { GazePaneHit, GazePaneReply } from '../../shared/gaze-pane-contract'

/** Translate a desktop logical point into Orca's live renderer geometry. */
export async function queryGazePane(
  runtime: OrcaRuntimeService,
  point: { x: number; y: number } | null,
  highlight: boolean,
  debug = false
): Promise<GazePaneHit | null> {
  const window = runtime.getAuthoritativeWindow()
  const contents = window.webContents
  const contentBounds = window.getContentBounds()
  const zoom = contents.getZoomFactor()
  const x = point ? (point.x - contentBounds.x) / zoom : -1
  const y = point ? (point.y - contentBounds.y) / zoom : -1
  const inside =
    point !== null &&
    x >= 0 &&
    y >= 0 &&
    x < contentBounds.width / zoom &&
    y < contentBounds.height / zoom
  if (!inside && !highlight) {
    return null
  }

  const requestId = randomUUID()
  const reply = await new Promise<GazePaneReply>((resolve, reject) => {
    const surface = getRuntimeDesktopSurface()
    const cleanup = (): void => {
      clearTimeout(timer)
      surface.removeIpcListener('gaze:paneReply', handler)
    }
    const handler = (event: IpcMainEvent, response: GazePaneReply): void => {
      if (event.sender !== contents || response?.requestId !== requestId) {
        return
      }
      cleanup()
      resolve(response)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Gaze pane lookup timed out'))
    }, 2000)
    surface.onIpc('gaze:paneReply', handler)
    contents.send('gaze:resolvePane', {
      requestId,
      x: inside ? x : -1,
      y: inside ? y : -1,
      highlight,
      debug
    })
  })
  if (!reply.hit) {
    return null
  }
  return {
    ...reply.hit,
    bounds: {
      x: reply.hit.bounds.x * zoom + contentBounds.x,
      y: reply.hit.bounds.y * zoom + contentBounds.y,
      width: reply.hit.bounds.width * zoom,
      height: reply.hit.bounds.height * zoom
    }
  }
}
