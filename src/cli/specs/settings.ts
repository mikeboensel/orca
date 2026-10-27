import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SETTINGS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['settings', 'list'],
    summary: 'List every Orca app setting with its value, type and valid values',
    usage: 'orca settings list [--filter <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'filter'],
    notes: [
      '--filter matches the key, the Settings screen label and its description, case-insensitively.',
      'Read-only rows are owned by a dedicated Orca flow (accounts, plugins, privacy) or are internal migration state; --json gives readOnlyReason and readOnlyDetail.'
    ],
    examples: [
      'orca settings list',
      'orca settings list --filter terminal',
      'orca settings list --json'
    ]
  },
  {
    path: ['settings', 'show'],
    aliases: [['settings', 'get']],
    summary: 'Show one Orca app setting, its valid values and its Settings screen text',
    usage: 'orca settings show <key> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key'],
    positionalArgs: ['key'],
    examples: ['orca settings show terminalFontSize', 'orca settings get theme --json']
  },
  {
    path: ['settings', 'set'],
    summary: 'Change an Orca app setting; the running app applies it live',
    usage: 'orca settings set <key> <value> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key', 'value'],
    positionalArgs: ['key', 'value'],
    notes: [
      'Orca parses <value> by the setting type: true/false, a number, enum member, plain text, a JSON array or comma-separated list, or JSON for structured settings. Nullable settings accept null.',
      'Invalid values are rejected with the valid set. Writes run the same checks and side effects as the Settings screen, and open windows update immediately.',
      'Use --value=<text> for values that start with a dash.'
    ],
    examples: [
      'orca settings set skipCloseTerminalWithRunningProcessConfirm false',
      'orca settings set theme dark',
      'orca settings set terminalFontSize 15',
      'orca settings set visibleTaskProviders github,linear'
    ]
  }
]
