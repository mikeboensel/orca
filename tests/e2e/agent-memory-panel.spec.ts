import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'

const SHOT_DIR = process.env.AGENT_MEMORY_SHOT_DIR ?? 'test-results'

function memoryFile(name: string, type: string, description: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  type: ${type}\n---\n\n${body}\n`
}

test('reviews Claude project memories in the Memory panel and archives through a confirm', async ({
  electronApp,
  orcaPage
}) => {
  const home = await electronApp.evaluate(() => process.env.HOME ?? '')
  const repoPath = await orcaPage.evaluate(() => {
    const state = window.__store!.getState()
    const worktree = state.activeWorktreeId
      ? state.getKnownWorktreeById(state.activeWorktreeId)
      : null
    return state.repos.find((repo) => repo.id === worktree?.repoId)?.path ?? ''
  })
  expect(repoPath).not.toBe('')
  const memoryDir = path.join(
    home,
    '.claude',
    'projects',
    repoPath.replace(/[^A-Za-z0-9]/g, '-'),
    'memory'
  )
  mkdirSync(memoryDir, { recursive: true })
  const memories = {
    'feedback_explicit_naming.md': memoryFile(
      'explicit-naming',
      'feedback',
      'Favor very explicit names',
      'Reject `utils/` and `helpers/`; name modules after what they hold.'
    ),
    'project_release_flow.md': memoryFile(
      'release-flow',
      'project',
      'Releases ship through the release bot',
      'Never hand-dispatch the production deploy; run /release-prod.'
    ),
    'project_old_spike.md': memoryFile(
      'old-spike',
      'project',
      'Spike branch notes',
      'The flow-dom spike lives on branch spike/flow-dom; drop it once merged.'
    )
  }
  for (const [fileName, text] of Object.entries(memories)) {
    writeFileSync(path.join(memoryDir, fileName), text)
  }
  writeFileSync(
    path.join(memoryDir, 'MEMORY.md'),
    '- [Explicit naming](feedback_explicit_naming.md) — names\n- [Release flow](project_release_flow.md) — releases\n- [Old spike](project_old_spike.md) — spike\n'
  )
  writeFileSync(
    path.join(memoryDir, '.memory-review.json'),
    JSON.stringify({
      version: 1,
      records: {
        'claude-memory:feedback_explicit_naming.md': {
          contentHash: 'unreviewed',
          shares: [],
          acknowledgedStaleness: [],
          history: [],
          suggestion: {
            verdict: 'SHARE',
            reason: 'Repo-agnostic code rule; Codex should follow it too',
            by: 'audit',
            at: '2026-10-27T00:00:00Z'
          }
        }
      }
    })
  )

  await orcaPage.evaluate(() => {
    const state = window.__store!.getState()
    state.setRightSidebarOpen(true)
    state.setRightSidebarWidth(420)
    state.setRightSidebarTab('memory')
  })
  const card = orcaPage.locator('[aria-label^="Memory review card"]')
  await expect(card).toBeVisible()
  // The fixture repo's own CLAUDE.md (read from main) sorts first; ↓ skips it.
  await card.focus()
  await orcaPage.keyboard.press('ArrowDown')
  await expect(card.getByText('explicit-naming')).toBeVisible()
  await expect(card.getByText('Suggested: Share')).toBeVisible()
  await orcaPage.screenshot({ path: path.join(SHOT_DIR, 'agent-memory-cards.png') })

  // → keeps it (record only, applied at once); ← queues an archive for the confirm.
  await card.focus()
  await orcaPage.keyboard.press('ArrowRight')
  await expect(card.getByText('old-spike')).toBeVisible()
  await orcaPage.keyboard.press('ArrowLeft')
  await orcaPage.getByRole('button', { name: 'Review and apply' }).click()
  const dialog = orcaPage.getByRole('dialog')
  await expect(dialog.getByText(/Move to .*archive/)).toBeVisible()
  await expect(dialog).toHaveCSS('opacity', '1')
  await orcaPage.screenshot({ path: path.join(SHOT_DIR, 'agent-memory-archive-confirm.png') })
  await dialog.getByRole('button', { name: 'Apply' }).click()
  await expect(dialog).toBeHidden()
  expect(existsSync(path.join(memoryDir, 'archive', 'project_old_spike.md'))).toBe(true)
  expect(readFileSync(path.join(memoryDir, 'MEMORY.md'), 'utf8')).not.toContain(
    'project_old_spike.md'
  )

  await orcaPage.getByRole('radio', { name: 'List' }).click()
  await orcaPage.getByRole('combobox').first().click()
  await orcaPage.getByRole('option', { name: 'All' }).click()
  await expect(orcaPage.locator('[data-slot="select-content"]')).toHaveCount(0)
  await expect(orcaPage.getByText('explicit-naming')).toBeVisible()
  await orcaPage.screenshot({ path: path.join(SHOT_DIR, 'agent-memory-list.png') })
})
