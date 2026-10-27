import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  getOptionalStringFlag,
  getRequiredStringFlag,
  getRequiredStringFlagAllowingEmpty
} from '../flags'
import { printResult } from '../format'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'
import {
  formatGlobalSettingDetail,
  formatGlobalSettingSet,
  formatGlobalSettingsList,
  type GlobalSettingSetResult
} from '../settings-format'
import type { GlobalSettingsCliEntryWithValue } from '../../shared/global-settings-cli/global-settings-cli-types'

export async function callGlobalSettingsMethod<TResult>(
  client: Pick<HandlerContext['client'], 'call'>,
  method: 'settings.listGlobal' | 'settings.getGlobal' | 'settings.setGlobal',
  params: Record<string, string>
): Promise<RuntimeRpcSuccess<TResult>> {
  try {
    return await client.call<TResult>(method, params)
  } catch (error) {
    if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This Orca app cannot list or change settings from the CLI yet. Update Orca and try again.'
      )
    }
    throw error
  }
}

export const SETTINGS_HANDLERS: Record<string, CommandHandler> = {
  'settings list': async ({ client, flags, json }) => {
    const filter = getOptionalStringFlag(flags, 'filter')
    const result = await callGlobalSettingsMethod<{ settings: GlobalSettingsCliEntryWithValue[] }>(
      client,
      'settings.listGlobal',
      filter ? { filter } : {}
    )
    printResult(result, json, (value) => formatGlobalSettingsList(value.settings))
  },
  'settings show': async ({ client, flags, json }) => {
    const result = await callGlobalSettingsMethod<{ setting: GlobalSettingsCliEntryWithValue }>(
      client,
      'settings.getGlobal',
      { key: getRequiredStringFlag(flags, 'key') }
    )
    printResult(result, json, (value) => formatGlobalSettingDetail(value.setting))
  },
  'settings set': async ({ client, flags, json }) => {
    const result = await callGlobalSettingsMethod<GlobalSettingSetResult>(
      client,
      'settings.setGlobal',
      {
        key: getRequiredStringFlag(flags, 'key'),
        value: getRequiredStringFlagAllowingEmpty(flags, 'value')
      }
    )
    printResult(result, json, formatGlobalSettingSet)
  }
}
