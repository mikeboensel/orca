// Reads GlobalSettings from source so a new key whose kind cannot be inferred fails here, not in the CLI.
import path from 'node:path'
import ts from 'typescript-api'
import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../constants'
import type { GlobalSettings } from '../global-settings-types'
import englishCatalog from '../../renderer/src/i18n/locales/en.json'
import { buildGlobalSettingsCliSchema } from './global-settings-cli-schema'
import { GLOBAL_SETTINGS_SCREEN_TEXT_KEYS } from './global-settings-screen-text-keys'
import { lookupI18nCatalogString } from './global-settings-screen-text-lookup'
import type { GlobalSettingsCliValueKind } from './global-settings-cli-types'

const TYPES_FILE = path.resolve(__dirname, '../global-settings-types.ts')

type DeclaredSetting = { key: string; kind: GlobalSettingsCliValueKind; nullable: boolean }

function isStringLiteralUnion(type: ts.Type): boolean {
  const members = type.isUnion() ? type.types : [type]
  return members.every(
    (member) => member.isStringLiteral() || (member.flags & ts.TypeFlags.TemplateLiteral) !== 0
  )
}

function declaredKind(checker: ts.TypeChecker, type: ts.Type): GlobalSettingsCliValueKind {
  if ((type.flags & ts.TypeFlags.BooleanLike) !== 0) {
    return 'boolean'
  }
  if ((type.flags & ts.TypeFlags.NumberLike) !== 0) {
    return 'number'
  }
  if ((type.flags & ts.TypeFlags.String) !== 0) {
    return 'string'
  }
  if (isStringLiteralUnion(type)) {
    return 'enum'
  }
  if (checker.isArrayType(type)) {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: isArrayType proved this is an Array<T> type reference.
    const [element] = checker.getTypeArguments(type as ts.TypeReference)
    if ((element.flags & ts.TypeFlags.String) !== 0) {
      return 'string-list'
    }
    return isStringLiteralUnion(element) ? 'enum-list' : 'json'
  }
  return 'json'
}

function readDeclaredSettings(): DeclaredSetting[] {
  const program = ts.createProgram([TYPES_FILE], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler
  })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(TYPES_FILE)
  const alias = source?.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === 'GlobalSettings'
  )
  if (!alias) {
    throw new Error('GlobalSettings type alias not found')
  }
  return checker.getPropertiesOfType(checker.getTypeAtLocation(alias.name)).map((property) => {
    const declared = checker.getTypeOfSymbol(property)
    const nonNullable = checker.getNonNullableType(declared)
    const members = declared.isUnion() ? declared.types : [declared]
    return {
      key: property.name,
      kind: declaredKind(checker, nonNullable),
      nullable: members.some((member) => (member.flags & ts.TypeFlags.Null) !== 0)
    }
  })
}

function lookupEnglish(i18nKey: string): string | null {
  return lookupI18nCatalogString(englishCatalog, i18nKey)
}

describe('global settings CLI schema coverage', () => {
  const declared = readDeclaredSettings()
  const defaults: GlobalSettings = getDefaultSettings('/home/orca-test')
  const schema = new Map(
    buildGlobalSettingsCliSchema(defaults, defaults, lookupEnglish).map((entry) => [
      entry.key,
      entry
    ])
  )

  it('reads the declared settings type', () => {
    expect(declared.length).toBeGreaterThan(200)
  })

  it('gives every GlobalSettings key an entry whose kind matches its declared type', () => {
    const problems = declared.flatMap(({ key, kind }) => {
      const entry = schema.get(key)
      if (!entry) {
        return [
          `${key}: no default value; add { kind: '${kind}' } to GLOBAL_SETTINGS_KIND_OVERRIDES`
        ]
      }
      // An empty-array default cannot show its element type; a JSON array still round-trips.
      const compatible = entry.kind === kind || (entry.kind === 'json' && kind === 'string-list')
      return compatible ? [] : [`${key}: schema says ${entry.kind}, type says ${kind}`]
    })
    expect(problems).toEqual([])
  })

  // A missing null option only blocks clearing; accepting null for a non-null type corrupts settings.
  it('accepts null only for settings whose type allows it', () => {
    const problems = declared.flatMap(({ key, nullable }) =>
      schema.get(key)?.nullable && !nullable ? [`${key}: type does not allow null`] : []
    )
    expect(problems).toEqual([])
  })

  it('links only Settings screen text that exists in the English catalog', () => {
    const missing = Object.entries(GLOBAL_SETTINGS_SCREEN_TEXT_KEYS).flatMap(([key, textKeys]) =>
      (textKeys ?? [])
        .filter((i18nKey): i18nKey is string => i18nKey !== undefined)
        .filter((i18nKey) => lookupEnglish(i18nKey) === null)
        .map((i18nKey) => `${key}: ${i18nKey}`)
    )
    expect(missing).toEqual([])
  })
})
