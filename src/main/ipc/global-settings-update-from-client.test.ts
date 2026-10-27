import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../shared/global-settings-types'

const { handleMock, nativeThemeMock, reconcileClaudeAgentViewMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  nativeThemeMock: { themeSource: 'system' },
  reconcileClaudeAgentViewMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/test/user-data'), isPackaged: false },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  ipcMain: { handle: handleMock, on: vi.fn() },
  nativeTheme: nativeThemeMock
}))
vi.mock('../ghostty/index', () => ({ previewGhosttyImport: vi.fn() }))
vi.mock('../warp-themes', () => ({ previewWarpThemeImport: vi.fn() }))
vi.mock('../network/proxy-settings', () => ({ applyElectronProxySettings: vi.fn() }))
vi.mock('../browser/browser-session-proxy', () => ({ applyBrowserSessionProxies: vi.fn() }))
vi.mock('../browser/browser-session-registry', () => ({
  browserSessionRegistry: { listProfiles: vi.fn(() => []) }
}))
vi.mock('../app-icon', () => ({ applyAppIcon: vi.fn() }))
vi.mock('../ai-vault-search/session-search-enablement', () => ({
  applySessionSearchSettingsChange: vi.fn()
}))
vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../agent-hooks/managed-agent-hook-controls', () => ({
  applyAgentStatusHooksEnabled: vi.fn()
}))
vi.mock('../claude/agent-view-service', () => ({
  getClaudeAgentViewService: () => ({ reconcile: reconcileClaudeAgentViewMock })
}))
vi.mock('../worktree-root-preparation', () => ({ prepareLocalWorktreeRootsForRepos: vi.fn() }))
vi.mock('../menu/register-app-menu', () => ({ rebuildAppMenu: vi.fn() }))
vi.mock('../../shared/runtime-environment-store', () => ({
  resolveEnvironment: vi.fn(),
  listEnvironments: vi.fn(() => [])
}))

import { applyGlobalSettingsUpdateFromClient } from './global-settings-update-from-client'
import { registerSettingsHandlers } from './settings'
import { getGlobalSettingsCliBridge } from '../runtime/global-settings-cli-bridge'

const store = {
  getSettings: vi.fn(() => ({ theme: 'system' })),
  updateSettings: vi.fn((updates: Partial<GlobalSettings>) => ({ theme: 'system', ...updates })),
  updateSettingsAndFlush: vi.fn(),
  getGitHubCache: vi.fn(),
  setGitHubCache: vi.fn(),
  onSettingsChanged: vi.fn(() => () => {})
}
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: settings code only calls the store methods this fixture supplies.
const fixtureStore = store as never

// Renderer and runtime callers send untrusted keys, legacy fields included.
function untrustedUpdates(updates: Record<string, unknown>): Partial<GlobalSettings> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the code under test must sanitize arbitrary keys.
  return updates as Partial<GlobalSettings>
}

const PROTECTED_AND_LEGACY_UPDATES = {
  pluginConsents: { 'acme.plugin': 'fingerprint' },
  disabledPlugins: ['acme.plugin'],
  activeRuntimeEnvironmentId: 'remote-env',
  floatingTerminalTrustedCwds: ['/'],
  terminalScrollbackBytes: 1_000_000
}

describe('applyGlobalSettingsUpdateFromClient', () => {
  beforeEach(() => {
    store.updateSettings.mockClear()
    reconcileClaudeAgentViewMock.mockReset().mockResolvedValue(undefined)
    nativeThemeMock.themeSource = 'system'
  })

  it('strips main-owned keys, normalizes values and notifies every window', async () => {
    await applyGlobalSettingsUpdateFromClient(
      fixtureStore,
      untrustedUpdates({ ...PROTECTED_AND_LEGACY_UPDATES, theme: 'dark', terminalLineHeight: 9 })
    )

    expect(store.updateSettings).toHaveBeenCalledWith(
      { theme: 'dark', terminalLineHeight: 3 },
      { notifyListeners: true, originWebContentsId: undefined }
    )
    expect(nativeThemeMock.themeSource).toBe('dark')
  })

  it('binds the runtime bridge to the same path as the window settings:set handler', async () => {
    registerSettingsHandlers(fixtureStore)
    const windowSet = handleMock.mock.calls.find(([channel]) => channel === 'settings:set')?.[1]
    const updates = untrustedUpdates({
      ...PROTECTED_AND_LEGACY_UPDATES,
      skipCloseTerminalWithRunningProcessConfirm: false
    })

    await windowSet({ sender: { id: 7 } }, updates)
    await getGlobalSettingsCliBridge().applyUpdate(updates)

    expect(store.updateSettings.mock.calls).toEqual([
      [
        { skipCloseTerminalWithRunningProcessConfirm: false },
        { notifyListeners: true, originWebContentsId: 7 }
      ],
      [
        { skipCloseTerminalWithRunningProcessConfirm: false },
        { notifyListeners: true, originWebContentsId: undefined }
      ]
    ])
  })
})
