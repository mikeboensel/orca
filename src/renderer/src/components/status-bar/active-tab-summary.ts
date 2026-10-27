import type { AppState } from '@/store/types'
import { resolveTerminalTabTitle } from '../../../../shared/tab-title-resolution'
import { isTerminalLeafId, makePaneKey } from '../../../../shared/stable-pane-id'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

export type ActiveTabSummaryState = Pick<
  AppState,
  | 'activeWorktreeId'
  | 'activeTabType'
  | 'activeTabId'
  | 'tabsByWorktree'
  | 'terminalLayoutsByTabId'
  | 'agentStatusByPaneKey'
  | 'settings'
>

function findActiveTerminalTab(state: ActiveTabSummaryState) {
  if (!state.activeWorktreeId || state.activeTabType !== 'terminal' || !state.activeTabId) {
    return null
  }
  return (
    (state.tabsByWorktree[state.activeWorktreeId] ?? []).find(
      (tab) => tab.id === state.activeTabId
    ) ?? null
  )
}

export function selectActiveTabTitle(state: ActiveTabSummaryState): string {
  const tab = findActiveTerminalTab(state)
  return tab
    ? resolveTerminalTabTitle(tab, state.settings?.tabAutoGenerateTitle === true, tab.title)
    : ''
}

function selectActiveAgentEntry(state: ActiveTabSummaryState): AgentStatusEntry | null {
  const tab = findActiveTerminalTab(state)
  const leafId = tab ? state.terminalLayoutsByTabId[tab.id]?.activeLeafId : null
  if (!tab || !leafId || !isTerminalLeafId(leafId)) {
    return null
  }
  return state.agentStatusByPaneKey[makePaneKey(tab.id, leafId)] ?? null
}

/** Full text of the agent's latest reply (or its prompt before the first reply) in the focused pane. */
export function selectActiveTabRecap(state: ActiveTabSummaryState): string {
  const entry = selectActiveAgentEntry(state)
  if (!entry) {
    return ''
  }
  const message = entry.lastAssistantMessageIsToolOutput ? '' : entry.lastAssistantMessage?.trim()
  return message || entry.prompt.trim()
}

export function firstRecapLine(recap: string): string {
  const line = recap.split('\n').find((candidate) => candidate.trim()) ?? ''
  return line.replace(/\s+/g, ' ').trim()
}
