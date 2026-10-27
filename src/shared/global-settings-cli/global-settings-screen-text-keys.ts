import type { GlobalSettings } from '../global-settings-types'
import { TERMINAL_SETTINGS_SCREEN_TEXT_KEYS } from './global-settings-screen-text-keys-terminal'

/** i18n keys of the title and optional description a Settings screen row shows for a key. */
export type GlobalSettingsScreenTextKeys = readonly [titleKey: string, descriptionKey?: string]

// Keys absent here have no linked Settings screen row; the test checks every i18n key exists.
export const GLOBAL_SETTINGS_SCREEN_TEXT_KEYS: Partial<
  Record<keyof GlobalSettings, GlobalSettingsScreenTextKeys>
> = {
  ...TERMINAL_SETTINGS_SCREEN_TEXT_KEYS,
  agentHibernationIdleMs: [
    'auto.components.settings.ExperimentalPane.agentHibernation.idleMinutesLabel',
    'auto.components.settings.ExperimentalPane.agentHibernation.idleMinutesDescription'
  ],
  agentSkillSharingEnabled: ['auto.components.settings.shareSkills.allowAgentPublishing'],
  agentStatusHooksEnabled: ['auto.components.settings.agent-status-hooks-copy.7707c15abb'],
  agentWorkspaceTrustEnabled: [
    'auto.components.settings.agent-workspace-trust-copy.title',
    'auto.components.settings.agent-workspace-trust-copy.description'
  ],
  appFontFamily: ['auto.components.settings.AppearancePane.102d6b5f9b'],
  appIcon: ['auto.components.settings.AppearancePane.ca1590d42f'],
  artifactSharingEnabled: ['auto.components.settings.artifacts.allowPublishing'],
  autoRenameBranchFromWork: ['auto.components.settings.AutoRenameBranchFromWorkSetting.ef787db0e3'],
  branchPrefix: [
    'auto.components.settings.GitPane.330f584b50',
    'auto.components.settings.GitPane.1ffaadf0a0'
  ],
  branchPrefixCustom: [
    'auto.components.settings.GitPane.330f584b50',
    'auto.components.settings.GitPane.1ffaadf0a0'
  ],
  combinedDiffFileTreeVisibleByDefault: [
    'auto.components.settings.GeneralEditorSettingsSection.1de48ad940',
    'auto.components.settings.GeneralEditorSettingsSection.1b87897af9'
  ],
  computerAwakeMode: [
    'auto.components.settings.agent-awake-copy.e5995ce268',
    'auto.components.settings.agent-awake-copy.95d3031db2'
  ],
  confirmClosePinnedTab: [
    'auto.components.settings.GeneralPane.5cb5475664',
    'auto.components.settings.GeneralPane.36b2a5dc6d'
  ],
  ctrlTabOrderMode: [
    'auto.components.settings.RecentTabOrderControl.7a546f2309',
    'auto.components.settings.RecentTabOrderControl.a867a0889f'
  ],
  defaultTuiAgent: ['auto.components.settings.AgentsPane.385212c7a1'],
  diffDefaultView: [
    'auto.components.settings.GeneralEditorSettingsSection.7311f67ee7',
    'auto.components.settings.GeneralEditorSettingsSection.b492397d34'
  ],
  diffShowWhitespace: [
    'auto.components.settings.GeneralEditorSettingsSection.f1b3ceeb98',
    'auto.components.settings.GeneralEditorSettingsSection.94a479cef3'
  ],
  diffWordWrap: ['auto.components.settings.GeneralEditorSettingsSection.8f1afdfbd8'],
  editorAutoSave: [
    'auto.components.settings.GeneralEditorSettingsSection.0df2e4fd12',
    'auto.components.settings.GeneralEditorSettingsSection.70bb30feb1'
  ],
  editorAutoSaveDelayMs: ['auto.components.settings.GeneralEditorSettingsSection.d6cf227ca0'],
  editorFontFamily: [
    'auto.components.settings.EditorFontFamilySetting.title',
    'auto.components.settings.EditorFontFamilySetting.description'
  ],
  editorMinimapEnabled: [
    'auto.components.settings.GeneralEditorSettingsSection.6690b1ffb9',
    'auto.components.settings.GeneralEditorSettingsSection.51161d1647'
  ],
  editorPreviewTabsEnabled: [
    'auto.components.settings.GeneralPane.editor_preview_tabs',
    'auto.components.settings.GeneralPane.editor_preview_tabs_description'
  ],
  editorWordWrap: [
    'auto.components.settings.GeneralEditorSettingsSection.7ddd66fede',
    'auto.components.settings.GeneralEditorSettingsSection.9b18de6eea'
  ],
  experimentalAgentDashboardMode: [
    'auto.components.settings.ExperimentalPane.agentDashboard.title',
    'auto.components.settings.ExperimentalPane.agentDashboard.description'
  ],
  experimentalAgentDashboardPopout: [
    'auto.components.settings.ExperimentalPane.agentDashboard.title',
    'auto.components.settings.ExperimentalPane.agentDashboard.description'
  ],
  experimentalAgentHibernation: [
    'auto.components.settings.ExperimentalPane.agentHibernation.title',
    'auto.components.settings.ExperimentalPane.agentHibernation.description'
  ],
  experimentalNativeChat: [
    'auto.components.settings.ExperimentalPane.nativeChat.title',
    'auto.components.settings.ExperimentalPane.nativeChat.description'
  ],
  experimentalNewWorktreeCardStyle: [
    'auto.components.settings.ExperimentalPane.newWorktreeCardStyle.title',
    'auto.components.settings.ExperimentalPane.newWorktreeCardStyle.description'
  ],
  experimentalPet: ['auto.components.settings.ExperimentalPane.dd6f0a1d45'],
  experimentalTerminalAttention: ['auto.components.settings.ExperimentalPane.ec897e8d89'],
  floatingTerminalEnabled: [
    'auto.components.settings.FloatingWorkspacePane.5136813663',
    'auto.components.settings.FloatingWorkspacePane.41eb95f7f0'
  ],
  floatingTerminalTriggerLocation: [
    'auto.components.settings.FloatingWorkspacePane.5e5a8da236',
    'auto.components.settings.FloatingWorkspacePane.3c900e26e5'
  ],
  geminiCliOAuthEnabled: ['auto.components.settings.AccountsPane.96f3649526'],
  httpProxyBypassRules: [
    'auto.components.settings.AdvancedNetworkSettingsSection.f6d76cc8f4',
    'auto.components.settings.AdvancedNetworkSettingsSection.fb7130dcb9'
  ],
  httpProxyUrl: ['auto.components.settings.AdvancedNetworkSettingsSection.f00daf6324'],
  leftSidebarAppearanceMode: [
    'auto.components.settings.AppearancePane.leftSidebarAppearance.title'
  ],
  leftSidebarTintColor: ['auto.components.settings.AppearancePane.leftSidebarAppearance.tintColor'],
  leftSidebarTintOpacity: [
    'auto.components.settings.AppearancePane.leftSidebarAppearance.tintOpacity'
  ],
  localAccountRuntime: [
    'auto.components.settings.AccountsPane.46cf7e7495',
    'auto.components.settings.AccountsPane.2cd197025c'
  ],
  localWindowsRuntimeDefault: [
    'auto.components.settings.DefaultWindowsProjectRuntimeSetting.defaultRuntime'
  ],
  machineName: ['auto.components.settings.machine.name.search.title'],
  markdownReviewToolsEnabled: [
    'auto.components.settings.GeneralEditorSettingsSection.4edc104f0f',
    'auto.components.settings.GeneralEditorSettingsSection.f80603d293'
  ],
  minimaxGroupId: ['auto.components.settings.AccountsPane.bf160bb6c0'],
  minimizeToTrayOnClose: [
    'auto.components.settings.AppearancePane.2edf606c46',
    'auto.components.settings.AppearancePane.b707773a0d'
  ],
  mobileEmulatorDefaultDeviceUdid: [
    'auto.components.settings.MobileEmulatorSettingsPane.143961d031'
  ],
  mobileEmulatorEnabled: [
    'auto.components.settings.MobileEmulatorSettingsPane.700ddbf9b1',
    'auto.components.settings.MobileEmulatorSettingsPane.f9af91ea26'
  ],
  nativeChatAutoName: ['settings.chat.names.enable'],
  nestWorkspaces: [
    'auto.components.settings.GeneralWorkspaceSettingsSection.ba3480642f',
    'auto.components.settings.GeneralWorkspaceSettingsSection.4fbf910ded'
  ],
  nodeDistMirrorUrl: [
    'auto.components.settings.AdvancedNetworkSettingsSection.nodeDistMirrorLabel'
  ],
  openLinksInApp: ['auto.components.settings.BrowserPane.d3eb69c0aa'],
  opencodeSessionCookie: [
    'auto.components.settings.AccountsPane.36223200ac',
    'auto.components.settings.AccountsPane.0335bd31d5'
  ],
  opencodeWorkspaceId: [
    'auto.components.settings.AccountsPane.02cb127710',
    'auto.components.settings.AccountsPane.d70a5287a4'
  ],
  primarySelectionMiddleClickPaste: ['auto.components.settings.InputPane.ad31c3c5fb'],
  promptCacheTimerEnabled: [
    'auto.components.settings.AgentCacheTimerSection.b4e7302944',
    'auto.components.settings.AgentCacheTimerSection.9c20253679'
  ],
  promptCacheTtlMs: [
    'auto.components.settings.AgentCacheTimerSection.a2a8962138',
    'auto.components.settings.AgentCacheTimerSection.80c454e8a6'
  ],
  richMarkdownSpellcheckEnabled: [
    'auto.components.settings.GeneralEditorSettingsSection.b82f86d7d2',
    'auto.components.settings.GeneralEditorSettingsSection.5195f0b9ef'
  ],
  showArtifactsButton: [
    'auto.components.settings.artifacts.showButton',
    'auto.components.settings.artifacts.showButtonDescription'
  ],
  showAutomationsButton: ['auto.components.settings.AppearancePane.511f270ebb'],
  showGitIgnoredFiles: [
    'auto.components.settings.AppearancePane.0fafabcf35',
    'auto.components.settings.AppearancePane.gitIgnoredGlossary'
  ],
  showMenuBarIcon: [
    'settings.appearance.menuBarIcon.title',
    'settings.appearance.menuBarIcon.description'
  ],
  showMobileButton: [
    'auto.components.settings.AppearancePane.9da1020447',
    'auto.components.settings.AppearancePane.61d842eca0'
  ],
  showPinnedWorktreesInGroups: [
    'auto.components.settings.AppearancePane.showPinnedWorktreesInGroups.title',
    'auto.components.settings.AppearancePane.showPinnedWorktreesInGroups.description'
  ],
  showSkillsButton: [
    'auto.components.settings.shareSkills.showButton',
    'auto.components.settings.shareSkills.showButtonDescription'
  ],
  showTasksButton: ['auto.components.settings.AppearancePane.cf81907069'],
  showTitlebarAppName: ['auto.components.settings.AppearancePane.9868f39007'],
  skipCloseTerminalWithRunningProcessConfirm: [
    'auto.components.settings.GeneralPane.confirm_running_work_close',
    'auto.components.settings.GeneralPane.confirm_running_work_close_description'
  ],
  skipDeleteArtifactConfirm: [
    'auto.components.settings.GeneralWorkspaceSettingsSection.31e300af1c',
    'auto.components.settings.GeneralWorkspaceSettingsSection.bf46474e33'
  ],
  skipDeleteAutomationConfirm: [
    'auto.components.settings.GeneralWorkspaceSettingsSection.ea98373cd8',
    'auto.components.settings.GeneralWorkspaceSettingsSection.824b98a0d9'
  ],
  skipDeleteWorktreeConfirm: [
    'auto.components.settings.GeneralWorkspaceSettingsSection.9f380934cf',
    'auto.components.settings.GeneralWorkspaceSettingsSection.28bc3d085e'
  ],
  sourceControlGroupOrder: ['auto.components.settings.GitPane.sourceControlGroupOrderTitle'],
  tabAutoGenerateTitle: ['auto.components.settings.agent-generated-tab-title-copy.19ad21615a'],
  theme: ['auto.components.settings.AppearancePane.932ff1fbff'],
  uiLanguage: ['settings.appearance.language.title'],
  windowBackgroundBlur: ['auto.components.settings.TerminalWindowSection.2b82242f43'],
  workspaceDir: ['auto.components.settings.GeneralWorkspaceSettingsSection.0e9fc0eadc'],
  worktreeVisibilityDefaults: ['auto.components.settings.RepositoryPane.externalWorktrees']
}
