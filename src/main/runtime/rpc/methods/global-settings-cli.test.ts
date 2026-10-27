import '../unused-default-rpc-methods.test-fixture'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { setGlobalSettingsCliBridge } from '../../global-settings-cli-bridge'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RpcRequest } from '../core'
import { RpcDispatcher } from '../dispatcher'
import { GLOBAL_SETTINGS_CLI_METHODS } from './global-settings-cli'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

describe('global settings CLI RPC methods', () => {
  let settings: GlobalSettings
  const applyUpdate = vi.fn(async (updates: Partial<GlobalSettings>) => {
    settings = { ...settings, ...updates }
    return settings
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these methods read settings through the bridge, never the runtime.
  const runtime = { getRuntimeId: () => 'test-runtime' } as unknown as OrcaRuntimeService
  const dispatcher = new RpcDispatcher({ runtime, methods: GLOBAL_SETTINGS_CLI_METHODS })

  beforeEach(() => {
    settings = {
      ...getDefaultSettings('/home/orca-test'),
      opencodeSessionCookie: 'cookie-value-xyz'
    }
    applyUpdate.mockClear()
    setGlobalSettingsCliBridge({ read: () => settings, applyUpdate })
  })

  afterEach(() => {
    setGlobalSettingsCliBridge(null)
  })

  it('lists settings with Settings screen text and filters by label', async () => {
    const response = await dispatcher.dispatch(
      makeRequest('settings.listGlobal', { filter: 'active chats or terminals' })
    )

    expect(response).toMatchObject({
      ok: true,
      result: {
        settings: [
          {
            key: 'skipCloseTerminalWithRunningProcessConfirm',
            kind: 'boolean',
            label: 'Confirm before closing active chats or terminals',
            onSettingsScreen: true,
            writable: true,
            value: false,
            defaultValue: false
          }
        ]
      }
    })
  })

  it('never returns secret values', async () => {
    const response = await dispatcher.dispatch(
      makeRequest('settings.getGlobal', { key: 'opencodeSessionCookie' })
    )

    expect(response).toMatchObject({
      ok: true,
      result: { setting: { value: null, redacted: true, isSet: true, writable: false } }
    })
    expect(JSON.stringify(response)).not.toContain('cookie-value-xyz')
  })

  it('writes a parsed value through the shared settings path', async () => {
    const response = await dispatcher.dispatch(
      makeRequest('settings.setGlobal', {
        key: 'skipCloseTerminalWithRunningProcessConfirm',
        value: 'true'
      })
    )

    expect(applyUpdate).toHaveBeenCalledWith({ skipCloseTerminalWithRunningProcessConfirm: true })
    expect(response).toMatchObject({
      ok: true,
      result: { setting: { value: true }, previousValue: false, requestedValue: true }
    })
  })

  it.each([
    [{ key: 'theme', value: 'blue' }, 'expected one of system, dark, light'],
    [{ key: 'pluginConsents', value: '{}' }, 'read-only from the CLI (main-owned)'],
    [
      { key: 'agentYoloDefaultsMigrated', value: 'false' },
      'read-only from the CLI (internal-state)'
    ],
    [{ key: 'terminalFontSiz', value: '12' }, 'Did you mean: terminalFontSize']
  ])('rejects %j without writing', async (params, message) => {
    const response = await dispatcher.dispatch(makeRequest('settings.setGlobal', params))

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'invalid_argument', message: expect.stringContaining(message) }
    })
    expect(applyUpdate).not.toHaveBeenCalled()
  })

  it('names the missing desktop app on hosts without a settings bridge', async () => {
    setGlobalSettingsCliBridge(null)

    const response = await dispatcher.dispatch(makeRequest('settings.listGlobal', {}))

    expect(response).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('need the Orca desktop app') }
    })
  })
})
