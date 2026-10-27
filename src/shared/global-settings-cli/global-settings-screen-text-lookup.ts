function isCatalogNode(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object'
}

/** Reads a dotted i18n key from a nested locale catalog; null when absent or not text. */
export function lookupI18nCatalogString(catalog: unknown, i18nKey: string): string | null {
  let node = catalog
  for (const segment of i18nKey.split('.')) {
    if (!isCatalogNode(node) || !Object.hasOwn(node, segment)) {
      return null
    }
    node = node[segment]
  }
  return typeof node === 'string' ? node : null
}
