import { resolveGazePane, setGazePaneDebug, setGazePaneHighlight } from '@/lib/gaze-pane-hit-test'

export function registerGazePaneIpcBridge(unsubs: (() => void)[]): void {
  const onQuery = window.api.ui.onGazePaneQuery
  const reply = window.api.ui.replyGazePaneQuery
  if (!onQuery || !reply) {
    return
  }
  unsubs.push(
    onQuery(({ requestId, x, y, highlight, debug }) => {
      const hit = resolveGazePane(x, y)
      if (highlight) {
        setGazePaneHighlight(hit)
        setGazePaneDebug(debug ? { x, y } : null, hit)
      }
      reply({ requestId, hit })
    })
  )
}
