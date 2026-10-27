import type { GlobalSettings } from '../global-settings-types'
import { AGENT_CHAT_PERMISSION_MODES } from '../agent-chat-permission-mode'
import { APP_ICON_OPTIONS } from '../app-icon'
import { COMPUTER_AWAKE_MODES } from '../computer-awake-mode'
import { TASK_PROVIDERS } from '../task-providers'
import { AGENT_PERMISSION_CHOICES } from '../tui-agent-permission-choice'
import { ALL_TUI_AGENTS } from '../tui-agent-display-names'
import {
  UI_LANGUAGE_CHINESE,
  UI_LANGUAGE_ENGLISH,
  UI_LANGUAGE_FRENCH,
  UI_LANGUAGE_JAPANESE,
  UI_LANGUAGE_KOREAN,
  UI_LANGUAGE_PORTUGUESE,
  UI_LANGUAGE_SPANISH,
  UI_LANGUAGE_SYSTEM
} from '../ui-language'

type IsStringLiteralUnion<V> = [V] extends [never]
  ? false
  : [V] extends [string]
    ? string extends V
      ? false
      : true
    : false

/** Settings whose type is a closed set of strings; their members cannot be read at runtime. */
export type GlobalSettingsEnumKey = {
  [K in keyof GlobalSettings]-?: IsStringLiteralUnion<NonNullable<GlobalSettings[K]>> extends true
    ? K
    : never
}[keyof GlobalSettings]

export type GlobalSettingsEnumListKey = {
  [K in keyof GlobalSettings]-?: NonNullable<GlobalSettings[K]> extends readonly (infer Member)[]
    ? IsStringLiteralUnion<Member> extends true
      ? K
      : never
    : never
}[keyof GlobalSettings]

type EnumListMember<K extends GlobalSettingsEnumListKey> =
  NonNullable<GlobalSettings[K]> extends readonly (infer Member)[] ? Member : never

/** Plugin language packs add `plugin:` languages; main's normalizer validates those. */
export const GLOBAL_SETTINGS_OPEN_ENUM_KEYS = ['uiLanguage'] as const
type GlobalSettingsOpenEnumKey = (typeof GLOBAL_SETTINGS_OPEN_ENUM_KEYS)[number]

// A new closed-set setting fails typecheck here until its members are listed.
export const GLOBAL_SETTINGS_ENUM_VALUES = {
  claudeAccountSwitchRunningSessions: ['ask', 'restart', 'keep'],
  agentPermissionDefault: AGENT_PERMISSION_CHOICES,
  branchPrefix: ['git-username', 'custom', 'none'],
  jiraIssueKeyCasing: ['lowercase', 'preserve'],
  theme: ['system', 'dark', 'light'],
  leftSidebarAppearanceMode: ['default', 'match-terminal', 'tinted'],
  uiLanguage: [
    UI_LANGUAGE_SYSTEM,
    UI_LANGUAGE_ENGLISH,
    UI_LANGUAGE_CHINESE,
    UI_LANGUAGE_KOREAN,
    UI_LANGUAGE_JAPANESE,
    UI_LANGUAGE_SPANISH,
    UI_LANGUAGE_FRENCH,
    UI_LANGUAGE_PORTUGUESE
  ],
  appIcon: APP_ICON_OPTIONS.map((option) => option.id),
  terminalGpuAcceleration: ['auto', 'on', 'off'],
  terminalLigatures: ['auto', 'on', 'off'],
  terminalCursorStyle: ['bar', 'block', 'underline'],
  localAccountRuntime: ['auto', 'host', 'wsl'],
  localAgentRuntime: ['host', 'wsl'],
  terminalWindowsPowerShellImplementation: ['auto', 'powershell.exe', 'pwsh.exe'],
  claudeAgentTeamsMode: ['off', 'in-process', 'native-panes-shim'],
  terminalLinkClickBehavior: ['none', 'actions', 'open'],
  terminalUrlMiddleClickBehavior: ['none', 'actions', 'open'],
  nativeChatPermissionMode: AGENT_CHAT_PERMISSION_MODES,
  sourceControlViewMode: ['list', 'tree'],
  sourceControlGroupOrder: ['changes-first', 'staged-first', 'untracked-first'],
  ctrlTabOrderMode: ['mru', 'sequential'],
  terminalShortcutPolicy: ['orca-first', 'terminal-first'],
  browserProfileScope: ['shared', 'repo', 'worktree'],
  floatingTerminalTriggerLocation: ['floating-button', 'status-bar'],
  diffDefaultView: ['inline', 'side-by-side'],
  defaultTuiAgent: [...ALL_TUI_AGENTS, 'blank'],
  defaultTaskViewPreset: ['all', 'issues', 'review', 'my-issues', 'my-prs', 'prs'],
  defaultTaskSource: TASK_PROVIDERS,
  minimaxEndpoint: ['overseas', 'cn'],
  zcodePlanSite: ['zai', 'bigmodel'],
  computerAwakeMode: COMPUTER_AWAKE_MODES,
  terminalMacOptionAsAlt: ['auto', 'true', 'false', 'left', 'right'],
  mobilePairingConnectionMode: ['automatic', 'local-only'],
  experimentalAgentDashboardMode: ['in-window', 'popout'],
  tabSwitchKeybindingSeed: ['pending', 'done']
} as const satisfies {
  readonly [K in GlobalSettingsEnumKey]: readonly NonNullable<GlobalSettings[K]>[]
}

export const GLOBAL_SETTINGS_ENUM_LIST_VALUES = {
  disabledTuiAgents: ALL_TUI_AGENTS,
  visibleTaskProviders: TASK_PROVIDERS
} as const satisfies {
  readonly [K in GlobalSettingsEnumListKey]: readonly EnumListMember<K>[]
}

type AssertNever<T extends never> = T

type EnumKeysMissingMembers = {
  [K in Exclude<GlobalSettingsEnumKey, GlobalSettingsOpenEnumKey>]: [
    Exclude<NonNullable<GlobalSettings[K]>, (typeof GLOBAL_SETTINGS_ENUM_VALUES)[K][number]>
  ] extends [never]
    ? never
    : K
}[Exclude<GlobalSettingsEnumKey, GlobalSettingsOpenEnumKey>]

type EnumListKeysMissingMembers = {
  [K in GlobalSettingsEnumListKey]: [
    Exclude<EnumListMember<K>, (typeof GLOBAL_SETTINGS_ENUM_LIST_VALUES)[K][number]>
  ] extends [never]
    ? never
    : K
}[GlobalSettingsEnumListKey]

// A member added to a settings union fails typecheck here until it is listed above.
export type GlobalSettingsEnumValuesExhaustive = AssertNever<EnumKeysMissingMembers>
export type GlobalSettingsEnumListValuesExhaustive = AssertNever<EnumListKeysMissingMembers>
