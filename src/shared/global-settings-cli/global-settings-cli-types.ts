export const GLOBAL_SETTINGS_CLI_VALUE_KINDS = [
  'boolean',
  'number',
  'string',
  'enum',
  'string-list',
  'enum-list',
  // Shape unknown at runtime: the CLI accepts a JSON value of the default's container type.
  'json'
] as const

export type GlobalSettingsCliValueKind = (typeof GLOBAL_SETTINGS_CLI_VALUE_KINDS)[number]

export const GLOBAL_SETTINGS_CLI_READ_ONLY_REASONS = [
  'main-owned',
  'secret',
  'account-credentials',
  'internal-state'
] as const

export type GlobalSettingsCliReadOnlyReason = (typeof GLOBAL_SETTINGS_CLI_READ_ONLY_REASONS)[number]

export type GlobalSettingsCliNumberRange = {
  min: number
  max: number
  integer?: boolean
}

export type GlobalSettingsCliEntry = {
  key: string
  kind: GlobalSettingsCliValueKind
  /** Accepted members for enum and enum-list kinds. */
  values?: readonly string[]
  /** Enum kinds that also accept other strings the app validates itself. */
  openEnum?: boolean
  nullable: boolean
  range?: GlobalSettingsCliNumberRange
  defaultValue: unknown
  label: string
  /** Null when no Settings screen text is linked to this key. */
  description: string | null
  onSettingsScreen: boolean
  writable: boolean
  readOnlyReason?: GlobalSettingsCliReadOnlyReason
  readOnlyDetail?: string
}

export type GlobalSettingsCliEntryWithValue = GlobalSettingsCliEntry & {
  value: unknown
  /** Secret values are never sent; only whether one is set. */
  redacted?: boolean
  isSet?: boolean
}
