import { homedir } from 'node:os'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { buildGlobalSettingsCliSchema } from '../../../../shared/global-settings-cli/global-settings-cli-schema'
import { GLOBAL_SETTINGS_CLI_REDACTED_KEYS } from '../../../../shared/global-settings-cli/global-settings-cli-protected-keys'
import type {
  GlobalSettingsCliEntry,
  GlobalSettingsCliEntryWithValue
} from '../../../../shared/global-settings-cli/global-settings-cli-types'
import { parseGlobalSettingsCliValue } from '../../../../shared/global-settings-cli/global-settings-cli-value-parsing'
import {
  GlobalSettingsCliGetParams,
  GlobalSettingsCliListParams,
  GlobalSettingsCliSetParams
} from '../../../../shared/rpc-contract/global-settings-cli-params'
import { getGlobalSettingsCliBridge } from '../../global-settings-cli-bridge'
import { loadGlobalSettingsScreenTextResolver } from '../../global-settings-cli-screen-text'
import { defineMethod, InvalidArgumentError } from '../core'

function withValue(
  entry: GlobalSettingsCliEntry,
  settings: ReadonlyMap<string, unknown>
): GlobalSettingsCliEntryWithValue {
  const value = settings.get(entry.key)
  if (GLOBAL_SETTINGS_CLI_REDACTED_KEYS.has(entry.key)) {
    return { ...entry, defaultValue: null, value: null, redacted: true, isSet: Boolean(value) }
  }
  return { ...entry, value }
}

async function readSchema(): Promise<{
  entries: GlobalSettingsCliEntry[]
  settings: ReadonlyMap<string, unknown>
}> {
  const current = getGlobalSettingsCliBridge().read()
  const entries = buildGlobalSettingsCliSchema(
    getDefaultSettings(homedir()),
    current,
    await loadGlobalSettingsScreenTextResolver()
  )
  return { entries, settings: new Map(Object.entries(current)) }
}

function findEntry(
  entries: readonly GlobalSettingsCliEntry[],
  key: string
): GlobalSettingsCliEntry {
  const entry = entries.find((candidate) => candidate.key === key)
  if (entry) {
    return entry
  }
  const needle = key.toLowerCase()
  const similar = entries
    .filter((candidate) => candidate.key.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((candidate) => candidate.key)
  const hint = similar.length > 0 ? ` Did you mean: ${similar.join(', ')}?` : ''
  throw new InvalidArgumentError(
    `Unknown setting "${key}". Run \`orca settings list\` to see every key.${hint}`
  )
}

function matchesFilter(entry: GlobalSettingsCliEntry, filter: string): boolean {
  const needle = filter.toLowerCase()
  return [entry.key, entry.label, entry.description ?? ''].some((text) =>
    text.toLowerCase().includes(needle)
  )
}

export const GLOBAL_SETTINGS_CLI_METHODS = [
  defineMethod({
    name: 'settings.listGlobal',
    permission: 'workspace',
    params: GlobalSettingsCliListParams,
    handler: async (params) => {
      const { entries, settings } = await readSchema()
      const filter = params.filter
      return {
        settings: entries
          .filter((entry) => !filter || matchesFilter(entry, filter))
          .map((entry) => withValue(entry, settings))
      }
    }
  }),
  defineMethod({
    name: 'settings.getGlobal',
    permission: 'workspace',
    params: GlobalSettingsCliGetParams,
    handler: async (params) => {
      const { entries, settings } = await readSchema()
      return { setting: withValue(findEntry(entries, params.key), settings) }
    }
  }),
  defineMethod({
    name: 'settings.setGlobal',
    permission: 'settings-write',
    params: GlobalSettingsCliSetParams,
    handler: async (params) => {
      const { entries, settings } = await readSchema()
      const entry = findEntry(entries, params.key)
      if (!entry.writable) {
        throw new InvalidArgumentError(
          `Setting "${entry.key}" is read-only from the CLI (${entry.readOnlyReason}): ${entry.readOnlyDetail}`
        )
      }
      const parsed = parseGlobalSettingsCliValue(entry, params.value)
      if (!parsed.ok) {
        throw new InvalidArgumentError(parsed.message)
      }
      const previous = withValue(entry, settings)
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: entry.key names a GlobalSettings field and parsed.value matched its schema kind.
      const updates = { [entry.key]: parsed.value } as Partial<GlobalSettings>
      const applied = new Map(
        Object.entries(await getGlobalSettingsCliBridge().applyUpdate(updates))
      )
      return {
        setting: withValue(entry, applied),
        previousValue: previous.value,
        // Main's normalizers may clamp or rewrite the requested value.
        requestedValue: parsed.value
      }
    }
  })
]
