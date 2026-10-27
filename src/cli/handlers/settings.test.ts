import { afterEach, describe, expect, it, vi } from 'vitest'
import { RuntimeClientError } from '../runtime-client'
import type { HandlerContext } from '../dispatch'
import { callGlobalSettingsMethod, SETTINGS_HANDLERS } from './settings'

const confirmSetting = {
  key: 'skipCloseTerminalWithRunningProcessConfirm',
  kind: 'boolean',
  nullable: false,
  defaultValue: false,
  label: 'Confirm before closing active chats or terminals',
  description: null,
  onSettingsScreen: true,
  writable: true,
  value: false
}

function context(flags: Record<string, string>, result: unknown) {
  const call = vi.fn(async () => ({ id: 'req-1', ok: true as const, result, _meta: undefined }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: settings handlers only use client.call, flags and json.
  const ctx = {
    client: { call },
    flags: new Map(Object.entries(flags)),
    cwd: '/',
    json: false
  } as unknown as HandlerContext
  return { ctx, call }
}

describe('orca settings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the raw value for the host to parse and prints what changed', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { ctx, call } = context(
      { key: confirmSetting.key, value: 'true' },
      { setting: { ...confirmSetting, value: true }, previousValue: false, requestedValue: true }
    )

    await SETTINGS_HANDLERS['settings set'](ctx)

    expect(call).toHaveBeenCalledWith('settings.setGlobal', {
      key: confirmSetting.key,
      value: 'true'
    })
    expect(log).toHaveBeenCalledWith(`${confirmSetting.key} = true (was false)`)
  })

  it('names the update instead of surfacing method_not_found from an older app', async () => {
    const client = {
      call: async (): Promise<never> => {
        throw new RuntimeClientError('method_not_found', 'Unknown method: settings.listGlobal')
      }
    }

    await expect(callGlobalSettingsMethod(client, 'settings.listGlobal', {})).rejects.toMatchObject(
      {
        code: 'incompatible_runtime',
        message: expect.stringContaining('Update Orca')
      }
    )
  })
})
