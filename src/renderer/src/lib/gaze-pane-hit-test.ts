import type { GazePaneHit, GazePaneRect } from '../../../shared/gaze-pane-contract'
import { useAppStore } from '../store'

function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}

function boundsOf(element: HTMLElement): GazePaneRect {
  const rect = element.getBoundingClientRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

function terminalLeaves(worktreeId: string, tabId: string | null): HTMLElement[] {
  const tab = tabId
    ? useAppStore.getState().unifiedTabsByWorktree[worktreeId]?.find((item) => item.id === tabId)
    : null
  if (tab?.contentType !== 'terminal') {
    return []
  }
  const overlay = Array.from(
    document.querySelectorAll<HTMLElement>('[data-terminal-overlay-tab-id]')
  ).find((element) => element.dataset.terminalOverlayTabId === tab.entityId)
  return Array.from(overlay?.querySelectorAll<HTMLElement>('.pane[data-leaf-id]') ?? [])
}

/** Resolve against Orca's rendered pane geometry, including terminals obscured by an overlay. */
export function resolveGazePane(x: number, y: number): GazePaneHit | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  const group = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tab-group-body-id][data-worktree-id]')
  ).find((candidate) => contains(candidate.getBoundingClientRect(), x, y))
  if (!group) {
    return null
  }

  const worktreeId = group.dataset.worktreeId!
  const groupId = group.dataset.tabGroupBodyId!
  const state = useAppStore.getState()
  const activeTabId =
    state.groupsByWorktree[worktreeId]?.find((item) => item.id === groupId)?.activeTabId ?? null
  const activeTab = activeTabId
    ? state.unifiedTabsByWorktree[worktreeId]?.find((item) => item.id === activeTabId)
    : null
  const leaf = terminalLeaves(worktreeId, activeTabId).find((candidate) =>
    contains(candidate.getBoundingClientRect(), x, y)
  )
  const target = leaf ?? group
  return {
    worktreeId,
    groupId,
    tabId: activeTabId,
    contentType: activeTab?.contentType ?? null,
    leafId: leaf?.dataset.leafId ?? null,
    bounds: boundsOf(target)
  }
}

export function setGazePaneHighlight(hit: GazePaneHit | null): void {
  document.querySelectorAll<HTMLElement>('[data-gaze-highlight]').forEach((element) => {
    element.removeAttribute('data-gaze-highlight')
  })
  if (!hit) {
    return
  }
  const group = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tab-group-body-id][data-worktree-id]')
  ).find(
    (candidate) =>
      candidate.dataset.tabGroupBodyId === hit.groupId &&
      candidate.dataset.worktreeId === hit.worktreeId
  )
  const target = hit.leafId
    ? terminalLeaves(hit.worktreeId, hit.tabId).find(
        (candidate) => candidate.dataset.leafId === hit.leafId
      )
    : group
  target?.setAttribute('data-gaze-highlight', 'true')
}

/** Show the measured point and resolved identity while investigating a layout mismatch. */
export function setGazePaneDebug(
  point: { x: number; y: number } | null,
  hit: GazePaneHit | null
): void {
  let marker = document.querySelector<HTMLElement>('[data-gaze-debug-marker]')
  if (!point || point.x < 0 || point.y < 0) {
    marker?.remove()
    return
  }
  if (!marker) {
    marker = document.createElement('div')
    marker.dataset.gazeDebugMarker = 'true'
    marker.setAttribute('aria-hidden', 'true')
    marker.append(document.createElement('span'))
    document.body.append(marker)
  }
  marker.style.left = `${point.x}px`
  marker.style.top = `${point.y}px`
  marker.firstElementChild!.textContent = hit
    ? `group ${hit.groupId} · tab ${hit.tabId ?? '-'} · leaf ${hit.leafId ?? '-'}`
    : 'No Orca pane'
}
