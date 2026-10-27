import type { GlobalSettingsCliEntry } from './global-settings-cli-types'

export type GlobalSettingsCliParsedValue =
  | { ok: true; value: unknown }
  | { ok: false; message: string }

function invalid(entry: GlobalSettingsCliEntry, expected: string): GlobalSettingsCliParsedValue {
  const nullHint = entry.nullable ? ', or null' : ''
  return { ok: false, message: `Invalid value for ${entry.key}: expected ${expected}${nullHint}.` }
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

// Lists accept a JSON array or comma-separated text; an empty string clears the list.
function parseStringList(raw: string): string[] | null {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return []
  }
  if (trimmed.startsWith('[')) {
    const parsed = parseJson(trimmed)
    if (!parsed.ok || !Array.isArray(parsed.value)) {
      return null
    }
    return parsed.value.every((item) => typeof item === 'string') ? parsed.value : null
  }
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

function parseNumber(entry: GlobalSettingsCliEntry, raw: string): GlobalSettingsCliParsedValue {
  const value = raw.trim() === '' ? Number.NaN : Number(raw)
  const range = entry.range
  const expected = range
    ? `${range.integer ? 'an integer' : 'a number'} from ${range.min} to ${range.max}`
    : 'a number'
  if (!Number.isFinite(value)) {
    return invalid(entry, expected)
  }
  if (
    range &&
    (value < range.min || value > range.max || (range.integer && !Number.isInteger(value)))
  ) {
    return invalid(entry, expected)
  }
  return { ok: true, value }
}

function parseEnumMember(entry: GlobalSettingsCliEntry, raw: string): GlobalSettingsCliParsedValue {
  const values = entry.values ?? []
  if (values.includes(raw) || (entry.openEnum && raw.trim() !== '')) {
    return { ok: true, value: raw }
  }
  return invalid(entry, `one of ${values.join(', ')}`)
}

function parseJsonValue(entry: GlobalSettingsCliEntry, raw: string): GlobalSettingsCliParsedValue {
  const parsed = parseJson(raw)
  const expectsArray = Array.isArray(entry.defaultValue)
  const expected = expectsArray ? 'a JSON array' : 'a JSON object'
  if (!parsed.ok) {
    return invalid(entry, expected)
  }
  const isArray = Array.isArray(parsed.value)
  const isObject = parsed.value !== null && typeof parsed.value === 'object' && !isArray
  const defaultIsObject =
    entry.defaultValue !== null && typeof entry.defaultValue === 'object' && !expectsArray
  // Without a default, either container shape is accepted.
  if ((expectsArray && !isArray) || (defaultIsObject && !isObject) || (!isArray && !isObject)) {
    return invalid(entry, expected)
  }
  return { ok: true, value: parsed.value }
}

export function parseGlobalSettingsCliValue(
  entry: GlobalSettingsCliEntry,
  raw: string
): GlobalSettingsCliParsedValue {
  if (entry.nullable && raw === 'null') {
    return { ok: true, value: null }
  }
  switch (entry.kind) {
    case 'boolean':
      return raw === 'true' || raw === 'false'
        ? { ok: true, value: raw === 'true' }
        : invalid(entry, 'true or false')
    case 'number':
      return parseNumber(entry, raw)
    case 'string':
      return { ok: true, value: raw }
    case 'enum':
      return parseEnumMember(entry, raw)
    case 'string-list': {
      const list = parseStringList(raw)
      return list
        ? { ok: true, value: list }
        : invalid(entry, 'a JSON string array or a comma-separated list')
    }
    case 'enum-list': {
      const list = parseStringList(raw)
      const values = entry.values ?? []
      if (!list || list.some((item) => !values.includes(item))) {
        return invalid(entry, `a list drawn from ${values.join(', ')}`)
      }
      return { ok: true, value: list }
    }
    case 'json':
      return parseJsonValue(entry, raw)
  }
}
