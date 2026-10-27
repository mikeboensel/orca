// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveGazePane, setGazePaneDebug, setGazePaneHighlight } from './gaze-pane-hit-test'

vi.mock('../store', () => ({
  useAppStore: {
    getState: () => ({
      groupsByWorktree: { work: [{ id: 'group-1', activeTabId: 'tab-1' }] },
      unifiedTabsByWorktree: {
        work: [{ id: 'tab-1', entityId: 'terminal-1', contentType: 'terminal' }]
      }
    })
  }
}))

function setRect(element: HTMLElement, x: number, y: number, width: number, height: number): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height))
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('resolveGazePane', () => {
  it('returns the active tab and exact terminal leaf under a renderer point', () => {
    const group = document.createElement('div')
    group.dataset.tabGroupBodyId = 'group-1'
    group.dataset.worktreeId = 'work'
    setRect(group, 100, 50, 600, 400)
    const left = document.createElement('div')
    left.className = 'pane'
    left.dataset.leafId = 'left'
    setRect(left, 100, 50, 300, 400)
    const right = document.createElement('div')
    right.className = 'pane'
    right.dataset.leafId = 'right'
    setRect(right, 400, 50, 300, 400)
    const overlay = document.createElement('div')
    overlay.dataset.terminalOverlayTabId = 'terminal-1'
    overlay.append(left, right)
    document.body.append(group, overlay)

    const hit = resolveGazePane(510, 300)
    expect(hit).toEqual({
      worktreeId: 'work',
      groupId: 'group-1',
      tabId: 'tab-1',
      contentType: 'terminal',
      leafId: 'right',
      bounds: { x: 400, y: 50, width: 300, height: 400 }
    })
    setGazePaneHighlight(hit)
    expect(right.dataset.gazeHighlight).toBe('true')
    setGazePaneDebug({ x: 510, y: 300 }, hit)
    const marker = document.querySelector<HTMLElement>('[data-gaze-debug-marker]')
    expect(marker?.style.left).toBe('510px')
    expect(marker?.textContent).toContain('leaf right')
    setGazePaneHighlight(null)
    setGazePaneDebug(null, null)
    expect(right.dataset.gazeHighlight).toBeUndefined()
    expect(document.querySelector('[data-gaze-debug-marker]')).toBeNull()
    expect(resolveGazePane(710, 300)).toBeNull()
  })
})
