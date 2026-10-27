import type { GlobalSettings } from '../../shared/global-settings-types'

export type GlobalSettingsCliBridge = {
  read(): GlobalSettings
  applyUpdate(updates: Partial<GlobalSettings>): Promise<GlobalSettings>
}

// The desktop IPC layer binds this so runtime RPC writes reuse the window settings:set path without importing Electron.
let bridge: GlobalSettingsCliBridge | null = null

export function setGlobalSettingsCliBridge(next: GlobalSettingsCliBridge | null): void {
  bridge = next
}

export function getGlobalSettingsCliBridge(): GlobalSettingsCliBridge {
  if (!bridge) {
    throw new Error('Settings commands need the Orca desktop app; this host has no settings UI.')
  }
  return bridge
}
