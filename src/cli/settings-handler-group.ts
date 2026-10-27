import type { HandlerGroup } from './handler-group-manifest'

export const SETTINGS_HANDLER_GROUP: HandlerGroup = {
  name: 'settings',
  keys: ['settings list', 'settings show', 'settings set'],
  load: async () => (await import('./handlers/settings.js')).SETTINGS_HANDLERS
}
