import type { GlobalSettings } from '../global-settings-types'
import type { GlobalSettingsScreenTextKeys } from './global-settings-screen-text-keys'

export const TERMINAL_SETTINGS_SCREEN_TEXT_KEYS: Partial<
  Record<keyof GlobalSettings, GlobalSettingsScreenTextKeys>
> = {
  terminalAllowOsc52Clipboard: [
    'auto.components.settings.TerminalPane.3338dcf8c1',
    'auto.components.settings.TerminalPane.6e6480a7df'
  ],
  terminalBackgroundOpacity: [
    'auto.components.settings.TerminalWindowSection.ea7b1a158e',
    'auto.components.settings.TerminalWindowSection.809f37738d'
  ],
  terminalClipboardOnSelect: [
    'auto.components.settings.TerminalPane.902f5dee1f',
    'components.settings.TerminalInteraction.copyOnSelectDescription'
  ],
  terminalColorOverrides: [
    'auto.components.settings.TerminalWindowSection.63f8d9336e',
    'auto.components.settings.TerminalWindowSection.e86e09b5c7'
  ],
  terminalCopyTrimsGutter: [
    'components.settings.TerminalInteraction.copyTrimsGutter',
    'components.settings.TerminalInteraction.copyTrimsGutterDescription'
  ],
  terminalCursorBlink: [
    'auto.components.settings.TerminalAppearanceSection.74736cc9b1',
    'auto.components.settings.TerminalAppearanceSection.2de6b5a699'
  ],
  terminalCursorOpacity: [
    'auto.components.settings.TerminalAppearanceSection.b9f1804422',
    'auto.components.settings.TerminalAppearanceSection.04cdf85dec'
  ],
  terminalCursorStyle: [
    'auto.components.settings.TerminalAppearanceSection.db270cc9a9',
    'auto.components.settings.TerminalAppearanceSection.d455f2ef4f'
  ],
  terminalDefaultShell: [
    'auto.components.settings.TerminalPane.fd05fb109c',
    'auto.components.settings.TerminalPane.69724e8f0c'
  ],
  terminalDividerThicknessPx: [
    'auto.components.settings.TerminalAppearanceSection.f27a99978d',
    'auto.components.settings.TerminalAppearanceSection.a14a427ae4'
  ],
  terminalFastScrollSensitivity: [
    'auto.components.settings.TerminalPane.scrollSpeed.fast',
    'auto.components.settings.TerminalPane.scrollSpeed.fastDescription'
  ],
  terminalFocusFollowsMouse: [
    'auto.components.settings.TerminalPane.8eefeaa3da',
    'auto.components.settings.TerminalPane.9129b7e805'
  ],
  terminalFontFamily: ['auto.components.settings.TerminalAppearanceSection.a408266e67'],
  terminalFontSize: [
    'auto.components.settings.TerminalFontSizeSetting.a4a352b1e9',
    'auto.components.settings.TerminalFontSizeSetting.0f4c92e595'
  ],
  terminalFontWeight: ['auto.components.settings.TerminalAppearanceSection.4aae5db258'],
  terminalFontWeightBold: [
    'auto.components.settings.TerminalAdvancedTypographyControls.f5fa1a08f1',
    'auto.components.settings.TerminalAdvancedTypographyControls.0e0d1ee15a'
  ],
  terminalGpuAcceleration: ['auto.components.settings.TerminalPane.c1fc9e9444'],
  terminalInactivePaneOpacity: [
    'auto.components.settings.TerminalAppearanceSection.a6fdd6a3b1',
    'auto.components.settings.TerminalAppearanceSection.dimUnfocusedPanes'
  ],
  terminalInlineImages: [
    'auto.components.settings.TerminalRenderingSection.6d4c55bacc',
    'auto.components.settings.TerminalRenderingSection.fffab5890b'
  ],
  terminalJISYenToBackslash: [
    'auto.components.settings.TerminalPane.19f4935159',
    'auto.components.settings.TerminalPane.4263e940e0'
  ],
  terminalLigatures: ['auto.components.settings.TerminalAppearanceSection.be8da35e7f'],
  terminalLineHeight: ['auto.components.settings.TerminalAppearanceSection.c084eb7d4c'],
  terminalMacOptionAsAlt: ['auto.components.settings.TerminalPane.0a10420e1a'],
  terminalMouseHideWhileTyping: ['auto.components.settings.TerminalWindowSection.3530908ef9'],
  terminalPaddingX: [
    'auto.components.settings.TerminalWindowSection.36b8402015',
    'auto.components.settings.TerminalWindowSection.25e2f8e8e1'
  ],
  terminalPaddingY: [
    'auto.components.settings.TerminalWindowSection.1afcc1d973',
    'auto.components.settings.TerminalWindowSection.1846f6ee6a'
  ],
  terminalScrollSensitivity: [
    'auto.components.settings.TerminalPane.scrollSpeed.title',
    'auto.components.settings.TerminalPane.scrollSpeed.description'
  ],
  terminalScrollbackRows: [
    'auto.components.settings.TerminalPane.9df53f7c14',
    'auto.components.settings.TerminalPane.81d86b2dd2'
  ],
  terminalShortcutPolicy: [
    'auto.components.settings.ShortcutTerminalPolicyControl.c3a554288e',
    'auto.components.settings.ShortcutTerminalPolicyControl.c43c7ff5f9'
  ],
  terminalThemeDark: ['auto.components.settings.TerminalThemeSections.9499ad1dc4'],
  terminalThemeLight: ['auto.components.settings.TerminalThemeSections.8273bc75d7'],
  terminalTuiScrollSensitivity: [
    'auto.components.settings.TerminalPane.scrollSpeed.tui',
    'auto.components.settings.TerminalPane.scrollSpeed.tuiDescription'
  ],
  terminalUseSeparateLightTheme: [
    'auto.components.settings.TerminalThemeSections.match_dark_mode',
    'auto.components.settings.TerminalThemeSections.match_dark_mode_description'
  ],
  terminalWindowsPowerShellImplementation: ['auto.components.settings.TerminalPane.fe20f79dd1'],
  terminalWindowsShell: [
    'auto.components.settings.TerminalPane.27e301f22c',
    'auto.components.settings.TerminalPane.09bf02de9a'
  ],
  terminalWordSeparator: [
    'auto.components.settings.TerminalPane.4bebcc2b2c',
    'auto.components.settings.TerminalPane.8a956cc91e'
  ]
}
