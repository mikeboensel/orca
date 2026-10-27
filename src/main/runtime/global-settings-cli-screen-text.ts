import type { GlobalSettingsScreenTextResolver } from '../../shared/global-settings-cli/global-settings-cli-schema'
import { lookupI18nCatalogString } from '../../shared/global-settings-cli/global-settings-screen-text-lookup'

let englishCatalog: Promise<unknown> | null = null

// English only: agents read CLI output, and the catalog loads lazily on the first settings command.
export async function loadGlobalSettingsScreenTextResolver(): Promise<GlobalSettingsScreenTextResolver> {
  englishCatalog ??= import('../../renderer/src/i18n/locales/en.json').then(
    (module) => module.default
  )
  const catalog = await englishCatalog
  return (i18nKey) => lookupI18nCatalogString(catalog, i18nKey)
}
