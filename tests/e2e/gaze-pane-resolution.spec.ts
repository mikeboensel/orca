import { test, expect } from './helpers/orca-app'
import { RuntimeClient } from '../../src/cli/runtime-client'
import type { GazePaneHit } from '../../src/shared/gaze-pane-contract'
import {
  splitActiveTerminalPane,
  waitForActiveTerminalManager,
  waitForPaneCount
} from './helpers/terminal'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('desktop gaze points resolve and highlight the exact Orca terminal leaf', async ({
  electronApp,
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await waitForActiveTerminalManager(orcaPage, 30_000)
  await waitForPaneCount(orcaPage, 1, 30_000)
  await splitActiveTerminalPane(orcaPage, 'vertical')
  await waitForPaneCount(orcaPage, 2)

  const leaves = orcaPage.locator('[data-terminal-overlay-tab-id] .pane[data-leaf-id]:visible')
  await expect(leaves).toHaveCount(2)
  const userDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const client = new RuntimeClient(userDataDir, 30_000, null, null)
  const content = await electronApp.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!
    return { bounds: window.getContentBounds(), zoom: window.webContents.getZoomFactor() }
  })

  for (const leaf of await leaves.all()) {
    const leafId = await leaf.getAttribute('data-leaf-id')
    const box = await leaf.boundingBox()
    expect(box).not.toBeNull()
    const cssPoint = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    const group = await orcaPage.evaluate(({ x, y }) => {
      const element = Array.from(
        document.querySelectorAll<HTMLElement>('[data-tab-group-body-id][data-worktree-id]')
      ).find((candidate) => {
        const rect = candidate.getBoundingClientRect()
        return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
      })
      return {
        groupId: element?.dataset.tabGroupBodyId ?? null,
        worktreeId: element?.dataset.worktreeId ?? null
      }
    }, cssPoint)
    expect(group.groupId).not.toBeNull()
    const point = {
      x: content.bounds.x + cssPoint.x * content.zoom,
      y: content.bounds.y + cssPoint.y * content.zoom
    }
    const { pane } = (
      await client.call<{ pane: GazePaneHit | null }>('gaze.resolve', {
        ...point,
        highlight: true,
        debug: true
      })
    ).result

    expect(pane).toMatchObject({
      leafId,
      groupId: group.groupId,
      worktreeId: group.worktreeId,
      contentType: 'terminal'
    })
    expect(pane!.bounds.x).toBeCloseTo(content.bounds.x + box!.x * content.zoom, 0)
    expect(pane!.bounds.y).toBeCloseTo(content.bounds.y + box!.y * content.zoom, 0)
    expect(pane!.bounds.width).toBeCloseTo(box!.width * content.zoom, 0)
    expect(pane!.bounds.height).toBeCloseTo(box!.height * content.zoom, 0)
    await expect(leaf).toHaveAttribute('data-gaze-highlight', 'true')
    await expect(orcaPage.locator('[data-gaze-highlight]')).toHaveCount(1)
    const marker = orcaPage.locator('[data-gaze-debug-marker]')
    await expect(marker).toContainText(`leaf ${leafId}`)
    const markerPoint = await marker.evaluate((element) => ({
      x: Number.parseFloat(getComputedStyle(element).left),
      y: Number.parseFloat(getComputedStyle(element).top)
    }))
    expect(markerPoint.x).toBeCloseTo(cssPoint.x, 0)
    expect(markerPoint.y).toBeCloseTo(cssPoint.y, 0)
  }

  await client.call('gaze.clear', {})
  await expect(orcaPage.locator('[data-gaze-highlight]')).toHaveCount(0)
  await expect(orcaPage.locator('[data-gaze-debug-marker]')).toHaveCount(0)
})
