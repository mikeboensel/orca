import type { GlobalSettingsCliEntryWithValue } from '../shared/global-settings-cli/global-settings-cli-types'

export type GlobalSettingSetResult = {
  setting: GlobalSettingsCliEntryWithValue
  previousValue: unknown
  requestedValue: unknown
}

const LIST_VALUE_MAX_CHARS = 60

function formatValue(entry: GlobalSettingsCliEntryWithValue, value: unknown): string {
  if (entry.redacted) {
    return entry.isSet ? '<redacted>' : '<not set>'
  }
  return value === undefined ? '<not set>' : JSON.stringify(value)
}

function truncate(text: string): string {
  return text.length > LIST_VALUE_MAX_CHARS ? `${text.slice(0, LIST_VALUE_MAX_CHARS - 1)}…` : text
}

function formatType(entry: GlobalSettingsCliEntryWithValue): string {
  const parts: string[] = [entry.kind]
  if (entry.values) {
    parts.push(`${entry.openEnum ? 'e.g. ' : ''}${entry.values.join(' | ')}`)
  }
  if (entry.range) {
    parts.push(`${entry.range.min}..${entry.range.max}${entry.range.integer ? ' integer' : ''}`)
  }
  if (entry.nullable) {
    parts.push('nullable')
  }
  return parts.join(', ')
}

export function formatGlobalSettingsList(
  entries: readonly GlobalSettingsCliEntryWithValue[]
): string {
  if (entries.length === 0) {
    return 'No settings match.'
  }
  return entries
    .map((entry) => {
      const access = entry.writable ? '' : ' [read-only]'
      return `${entry.key} = ${truncate(formatValue(entry, entry.value))}${access}\n  ${entry.label} (${truncate(formatType(entry))})`
    })
    .join('\n')
}

export function formatGlobalSettingDetail(entry: GlobalSettingsCliEntryWithValue): string {
  const access = entry.writable
    ? 'yes'
    : `no, ${entry.readOnlyReason}: ${entry.readOnlyDetail ?? ''}`.trim()
  return [
    `key: ${entry.key}`,
    `label: ${entry.label}`,
    `description: ${entry.description ?? (entry.onSettingsScreen ? '-' : 'No Settings screen text linked to this key.')}`,
    `type: ${formatType(entry)}`,
    `value: ${formatValue(entry, entry.value)}`,
    `default: ${formatValue(entry, entry.defaultValue)}`,
    `writable: ${access}`
  ].join('\n')
}

export function formatGlobalSettingSet(result: GlobalSettingSetResult): string {
  const { setting } = result
  const applied = formatValue(setting, setting.value)
  const lines = [`${setting.key} = ${applied} (was ${formatValue(setting, result.previousValue)})`]
  if (JSON.stringify(result.requestedValue) !== JSON.stringify(setting.value)) {
    lines.push(
      `Orca normalized the requested ${JSON.stringify(result.requestedValue)} to ${applied}.`
    )
  }
  return lines.join('\n')
}
