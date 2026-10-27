import type { GlobalSettings } from '../global-settings-types'
import {
  GLOBAL_SETTINGS_ENUM_LIST_VALUES,
  GLOBAL_SETTINGS_ENUM_VALUES,
  GLOBAL_SETTINGS_OPEN_ENUM_KEYS
} from './global-settings-enum-values'
import {
  GLOBAL_SETTINGS_KIND_OVERRIDES,
  GLOBAL_SETTINGS_NUMBER_RANGES
} from './global-settings-kind-overrides'
import { resolveGlobalSettingsCliProtection } from './global-settings-cli-protected-keys'
import { GLOBAL_SETTINGS_SCREEN_TEXT_KEYS } from './global-settings-screen-text-keys'
import type {
  GlobalSettingsCliEntry,
  GlobalSettingsCliValueKind
} from './global-settings-cli-types'

/** Resolves an i18n key to Settings screen text; null when the catalog lacks it. */
export type GlobalSettingsScreenTextResolver = (i18nKey: string) => string | null

const ENUM_VALUES_BY_KEY = new Map<string, readonly string[]>(
  Object.entries(GLOBAL_SETTINGS_ENUM_VALUES)
)
const ENUM_LIST_VALUES_BY_KEY = new Map<string, readonly string[]>(
  Object.entries(GLOBAL_SETTINGS_ENUM_LIST_VALUES)
)
const OPEN_ENUM_KEYS = new Set<string>(GLOBAL_SETTINGS_OPEN_ENUM_KEYS)
const KIND_OVERRIDES_BY_KEY = new Map(Object.entries(GLOBAL_SETTINGS_KIND_OVERRIDES))
const NUMBER_RANGES_BY_KEY = new Map(Object.entries(GLOBAL_SETTINGS_NUMBER_RANGES))
const SCREEN_TEXT_KEYS_BY_KEY = new Map(Object.entries(GLOBAL_SETTINGS_SCREEN_TEXT_KEYS))

export function inferGlobalSettingsCliKind(value: unknown): GlobalSettingsCliValueKind | null {
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'string') {
    return 'string'
  }
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')) {
    return 'string-list'
  }
  if (value !== null && typeof value === 'object') {
    return 'json'
  }
  return null
}

function resolveKind(
  key: string,
  defaultValue: unknown,
  currentValue: unknown
): GlobalSettingsCliValueKind {
  if (ENUM_VALUES_BY_KEY.has(key)) {
    return 'enum'
  }
  if (ENUM_LIST_VALUES_BY_KEY.has(key)) {
    return 'enum-list'
  }
  return (
    KIND_OVERRIDES_BY_KEY.get(key)?.kind ??
    inferGlobalSettingsCliKind(defaultValue) ??
    inferGlobalSettingsCliKind(currentValue) ??
    'json'
  )
}

function labelFromKeyName(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function buildGlobalSettingsCliEntry(
  key: string,
  defaults: ReadonlyMap<string, unknown>,
  current: ReadonlyMap<string, unknown>,
  resolveText: GlobalSettingsScreenTextResolver
): GlobalSettingsCliEntry {
  const defaultValue = defaults.get(key)
  const kind = resolveKind(key, defaultValue, current.get(key))
  const values = ENUM_VALUES_BY_KEY.get(key) ?? ENUM_LIST_VALUES_BY_KEY.get(key)
  const range = NUMBER_RANGES_BY_KEY.get(key)
  const [titleKey, descriptionKey] = SCREEN_TEXT_KEYS_BY_KEY.get(key) ?? []
  const label = titleKey ? resolveText(titleKey) : null
  const protection = resolveGlobalSettingsCliProtection(key)
  return {
    key,
    kind,
    ...(values ? { values } : {}),
    ...(OPEN_ENUM_KEYS.has(key) ? { openEnum: true } : {}),
    nullable: KIND_OVERRIDES_BY_KEY.get(key)?.nullable === true || defaultValue === null,
    ...(range ? { range } : {}),
    defaultValue,
    label: label ?? labelFromKeyName(key),
    description: descriptionKey ? resolveText(descriptionKey) : null,
    onSettingsScreen: label !== null,
    writable: protection === null,
    ...(protection ? { readOnlyReason: protection.reason, readOnlyDetail: protection.detail } : {})
  }
}

// Stored keys outside defaults and overrides are legacy fields, so they are not listed.
export function listGlobalSettingsCliKeys(defaults: ReadonlyMap<string, unknown>): string[] {
  const keys = new Set<string>([
    ...defaults.keys(),
    ...ENUM_VALUES_BY_KEY.keys(),
    ...ENUM_LIST_VALUES_BY_KEY.keys(),
    ...KIND_OVERRIDES_BY_KEY.keys()
  ])
  return [...keys].sort((left, right) => left.localeCompare(right))
}

export function buildGlobalSettingsCliSchema(
  defaults: GlobalSettings,
  current: GlobalSettings,
  resolveText: GlobalSettingsScreenTextResolver
): GlobalSettingsCliEntry[] {
  const defaultsByKey = new Map<string, unknown>(Object.entries(defaults))
  const currentByKey = new Map<string, unknown>(Object.entries(current))
  return listGlobalSettingsCliKeys(defaultsByKey).map((key) =>
    buildGlobalSettingsCliEntry(key, defaultsByKey, currentByKey, resolveText)
  )
}
