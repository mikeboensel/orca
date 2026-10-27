import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../constants'
import { buildGlobalSettingsCliSchema } from './global-settings-cli-schema'
import { parseGlobalSettingsCliValue } from './global-settings-cli-value-parsing'

const defaults = getDefaultSettings('/home/orca-test')
const schema = new Map(
  buildGlobalSettingsCliSchema(defaults, defaults, () => null).map((entry) => [entry.key, entry])
)

function parse(key: string, raw: string): unknown {
  const entry = schema.get(key)
  if (!entry) {
    throw new Error(`no schema entry for ${key}`)
  }
  return parseGlobalSettingsCliValue(entry, raw)
}

describe('parseGlobalSettingsCliValue', () => {
  it.each([
    ['skipCloseTerminalWithRunningProcessConfirm', 'false', false],
    ['terminalFontSize', '15', 15],
    ['terminalScrollbackRows', '10000', 10_000],
    ['theme', 'dark', 'dark'],
    ['defaultTuiAgent', 'null', null],
    ['defaultTuiAgent', 'blank', 'blank'],
    ['uiLanguage', 'plugin:acme.pack/de', 'plugin:acme.pack/de'],
    ['visibleTaskProviders', 'github, linear', ['github', 'linear']],
    ['visibleTaskProviders', '["jira"]', ['jira']],
    ['nativeChatShellEnvironmentVariables', '', []],
    ['worktreeVisibilityDefaults', '{"external":"show"}', { external: 'show' }],
    ['branchPrefixCustom', 'feature/', 'feature/']
  ])('parses %s %j', (key, raw, value) => {
    expect(parse(key, raw)).toEqual({ ok: true, value })
  })

  it.each([
    ['skipCloseTerminalWithRunningProcessConfirm', 'yes', 'expected true or false'],
    ['terminalFontSize', 'big', 'expected a number'],
    ['terminalScrollbackRows', '10', 'expected an integer from 1000 to 50000'],
    ['terminalLineHeight', '4', 'expected a number from 1 to 3'],
    ['theme', 'blue', 'expected one of system, dark, light'],
    ['theme', 'null', 'expected one of system, dark, light'],
    [
      'visibleTaskProviders',
      'github,trello',
      'expected a list drawn from github, gitlab, linear, jira'
    ],
    ['worktreeVisibilityDefaults', '[1]', 'expected a JSON object'],
    ['worktreeVisibilityDefaults', '{bad', 'expected a JSON object']
  ])('rejects %s %j with the valid set', (key, raw, message) => {
    expect(parse(key, raw)).toEqual({ ok: false, message: expect.stringContaining(message) })
  })
})
