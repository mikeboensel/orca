import type { GlobalSettings } from '../global-settings-types'
import { MAX_EDITOR_AUTO_SAVE_DELAY_MS, MIN_EDITOR_AUTO_SAVE_DELAY_MS } from '../constants'
import { MAX_LEFT_SIDEBAR_TINT_OPACITY } from '../left-sidebar-appearance'
import {
  MAX_TERMINAL_CONTRAST_RATIO,
  MIN_TERMINAL_CONTRAST_RATIO
} from '../terminal-minimum-contrast-settings'
import { TERMINAL_FONT_WEIGHT_MAX, TERMINAL_FONT_WEIGHT_MIN } from '../terminal-fonts'
import {
  MAX_TERMINAL_LINE_HEIGHT,
  MIN_TERMINAL_LINE_HEIGHT
} from '../terminal-line-height-settings'
import {
  DESKTOP_TERMINAL_SCROLLBACK_ROWS_MAX,
  DESKTOP_TERMINAL_SCROLLBACK_ROWS_MIN
} from '../terminal-scrollback-policy'
import type {
  GlobalSettingsCliNumberRange,
  GlobalSettingsCliValueKind
} from './global-settings-cli-types'

type GlobalSettingsKindOverride = {
  kind: Exclude<GlobalSettingsCliValueKind, 'enum' | 'enum-list'>
  nullable?: boolean
}

// Only keys whose default is null, absent or empty; other kinds are read from the default value.
export const GLOBAL_SETTINGS_KIND_OVERRIDES: Partial<
  Record<keyof GlobalSettings, GlobalSettingsKindOverride>
> = {
  terminalWindowsWslDistro: { kind: 'string', nullable: true },
  localAccountWslDistro: { kind: 'string', nullable: true },
  activeCodexManagedAccountId: { kind: 'string', nullable: true },
  activeClaudeManagedAccountId: { kind: 'string', nullable: true },
  activeRuntimeEnvironmentId: { kind: 'string', nullable: true },
  defaultRepoSelection: { kind: 'string-list', nullable: true },
  defaultLinearTeamSelection: { kind: 'string-list', nullable: true },
  mobileEmulatorDefaultDeviceUdid: { kind: 'string', nullable: true },
  androidSdkPath: { kind: 'string', nullable: true },
  mobileAutoRestoreFitMs: { kind: 'number', nullable: true },
  mobilePairingCustomAddress: { kind: 'string', nullable: true },
  // Empty-array defaults hide the element type.
  mobilePairingCustomAddresses: { kind: 'string-list' },
  nativeChatShellEnvironmentVariables: { kind: 'string-list' },
  nativeChatAppearance: { kind: 'json' },
  nativeChatAutoName: { kind: 'boolean' },
  nativeChatProviders: { kind: 'json' },
  hostSettingOverrides: { kind: 'json' },
  terminalBackgroundOpacity: { kind: 'number' },
  terminalMinimumContrastRatio: { kind: 'number' },
  terminalColorOverrides: { kind: 'json' },
  terminalPaddingX: { kind: 'number' },
  terminalPaddingY: { kind: 'number' },
  terminalWordSeparator: { kind: 'string' },
  terminalCursorOpacity: { kind: 'number' },
  terminalDefaultShellArgs: { kind: 'string-list' },
  localAgentWslDistro: { kind: 'string', nullable: true },
  browserSshWorkspaceRoutingEnabled: { kind: 'boolean' },
  browserSshWorkspaceRoutingDisabledTargetIds: { kind: 'string-list' },
  browserSshWorkspaceRoutingProbeSkippedTargetIds: { kind: 'string-list' },
  keybindings: { kind: 'json' },
  activeClaudeManagedAccountIdsByRuntime: { kind: 'json' },
  claudeCopiedSystemDefaultNoticeDismissed: { kind: 'boolean' },
  newWorkspaceSetupOnly: { kind: 'boolean' },
  codexSessionSourceHome: { kind: 'json' },
  agentStateRulesPath: { kind: 'string', nullable: true },
  agentStateRulesLiveUpdates: { kind: 'boolean' },
  dismissedSkillFreshnessNudges: { kind: 'string-list' },
  experimentalSidekick: { kind: 'boolean' },
  experimentalAgentDashboardPopout: { kind: 'boolean' },
  agentsSidebarIntroShown: { kind: 'boolean' },
  agentsSidebarMigratedFromExperimental: { kind: 'boolean' },
  experimentalAgentDashboardShowIdle: { kind: 'boolean' },
  experimentalCompactWorktreeCards: { kind: 'boolean' },
  gitlabProjects: { kind: 'json' },
  telemetry: { kind: 'json' },
  aiVaultSearch: { kind: 'json' }
}

// Bounds the main-process or shared normalizers clamp to; the CLI rejects values outside them.
export const GLOBAL_SETTINGS_NUMBER_RANGES: Partial<
  Record<keyof GlobalSettings, GlobalSettingsCliNumberRange>
> = {
  terminalScrollbackRows: {
    min: DESKTOP_TERMINAL_SCROLLBACK_ROWS_MIN,
    max: DESKTOP_TERMINAL_SCROLLBACK_ROWS_MAX,
    integer: true
  },
  terminalLineHeight: { min: MIN_TERMINAL_LINE_HEIGHT, max: MAX_TERMINAL_LINE_HEIGHT },
  terminalFontWeight: {
    min: TERMINAL_FONT_WEIGHT_MIN,
    max: TERMINAL_FONT_WEIGHT_MAX,
    integer: true
  },
  terminalFontWeightBold: {
    min: TERMINAL_FONT_WEIGHT_MIN,
    max: TERMINAL_FONT_WEIGHT_MAX,
    integer: true
  },
  terminalMinimumContrastRatio: {
    min: MIN_TERMINAL_CONTRAST_RATIO,
    max: MAX_TERMINAL_CONTRAST_RATIO
  },
  leftSidebarTintOpacity: { min: 0, max: MAX_LEFT_SIDEBAR_TINT_OPACITY },
  editorAutoSaveDelayMs: {
    min: MIN_EDITOR_AUTO_SAVE_DELAY_MS,
    max: MAX_EDITOR_AUTO_SAVE_DELAY_MS,
    integer: true
  }
}
