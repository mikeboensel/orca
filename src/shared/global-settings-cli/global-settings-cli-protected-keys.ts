import type { GlobalSettings } from '../global-settings-types'
import type { GlobalSettingsCliReadOnlyReason } from './global-settings-cli-types'

type GlobalSettingsCliProtection = {
  reason: GlobalSettingsCliReadOnlyReason
  detail: string
}

const PLUGIN_REVIEW =
  'Plugin consent and enablement go through the reviewed-fingerprint plugin handlers.'
const ACCOUNT_SWITCHING = 'Managed accounts are added and switched in Settings > Accounts.'

export const GLOBAL_SETTINGS_CLI_PROTECTED_KEYS: Partial<
  Record<keyof GlobalSettings, GlobalSettingsCliProtection>
> = {
  activeRuntimeEnvironmentId: {
    reason: 'main-owned',
    detail: 'The default host for new projects is set by Advanced controls (orca environment).'
  },
  floatingTerminalTrustedCwds: {
    reason: 'main-owned',
    detail: 'Only the main-process directory picker may grant trusted floating-workspace paths.'
  },
  pluginConsents: { reason: 'main-owned', detail: PLUGIN_REVIEW },
  disabledPlugins: { reason: 'main-owned', detail: PLUGIN_REVIEW },
  devPluginPaths: {
    reason: 'main-owned',
    detail: 'Adds plugin code to load; change it in Settings > Plugins.'
  },
  prBotAuthorOverrides: {
    reason: 'main-owned',
    detail: 'Changed one author at a time by the PR bot-author handler.'
  },
  keybindings: {
    reason: 'main-owned',
    detail: 'Legacy field; shortcuts live in ~/.orca/keybindings.json.'
  },
  telemetry: {
    reason: 'main-owned',
    detail: 'Telemetry consent changes go through Settings > Privacy.'
  },
  terminalQuickCommands: {
    reason: 'main-owned',
    detail: 'Quick commands are edited through the quick-command mutation handler.'
  },
  nativeChatSessionOptions: {
    reason: 'main-owned',
    detail: 'Chat session options are written by the chat session-option handler.'
  },
  opencodeSessionCookie: {
    reason: 'secret',
    detail: 'A browser session cookie; paste it in Settings > Accounts.'
  },
  codexManagedAccounts: { reason: 'account-credentials', detail: ACCOUNT_SWITCHING },
  activeCodexManagedAccountId: { reason: 'account-credentials', detail: ACCOUNT_SWITCHING },
  activeCodexManagedAccountIdsByRuntime: {
    reason: 'account-credentials',
    detail: ACCOUNT_SWITCHING
  },
  claudeManagedAccounts: { reason: 'account-credentials', detail: ACCOUNT_SWITCHING },
  activeClaudeManagedAccountId: { reason: 'account-credentials', detail: ACCOUNT_SWITCHING },
  activeClaudeManagedAccountIdsByRuntime: {
    reason: 'account-credentials',
    detail: ACCOUNT_SWITCHING
  },
  workspaceDirHistory: {
    reason: 'internal-state',
    detail: 'Recorded by Orca when the workspace directory changes.'
  }
}

/** Values of these keys never leave the host. */
export const GLOBAL_SETTINGS_CLI_REDACTED_KEYS: ReadonlySet<string> = new Set<keyof GlobalSettings>(
  ['opencodeSessionCookie']
)

// One-shot migration and rollout stamps; writing them would re-run or skip a migration.
const INTERNAL_STATE_KEY_PATTERN = /(Migrated\w*|MigrationApplied|Defaulted\w*|Seed)$/

const PROTECTIONS_BY_KEY = new Map(Object.entries(GLOBAL_SETTINGS_CLI_PROTECTED_KEYS))

export function resolveGlobalSettingsCliProtection(
  key: string
): GlobalSettingsCliProtection | null {
  const explicit = PROTECTIONS_BY_KEY.get(key)
  if (explicit) {
    return explicit
  }
  if (INTERNAL_STATE_KEY_PATTERN.test(key)) {
    return { reason: 'internal-state', detail: 'A one-shot migration or rollout stamp.' }
  }
  return null
}
