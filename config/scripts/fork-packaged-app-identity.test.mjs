import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const configPath = require.resolve('../electron-builder.config.cjs')

const MUTABLE_BUILD_ENV = [
  'ORCA_PACKAGED_APP_IDENTITY',
  'ORCA_MAC_RELEASE',
  'ORCA_MAC_DAILY',
  'ORCA_WIN_HOURLY',
  'ORCA_LINUX_ARM64_RELEASE',
  'ORCA_LOCAL_BUILD_VERSION'
]

/** Re-requires the config under a temporary env, then restores env and module cache. */
function loadConfigWithEnv(env) {
  const original = Object.fromEntries(MUTABLE_BUILD_ENV.map((key) => [key, process.env[key]]))
  try {
    for (const key of MUTABLE_BUILD_ENV) {
      delete process.env[key]
    }
    Object.assign(process.env, env)
    delete require.cache[configPath]
    return require('../electron-builder.config.cjs')
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    delete require.cache[configPath]
  }
}

describe('fork packaged app identity', () => {
  it('packages as upstream Orca by default', () => {
    const config = loadConfigWithEnv({ ORCA_LOCAL_BUILD_VERSION: '1.4.214-local.1.abc' })
    expect(config.appId).toBe('com.stablyai.orca')
    expect(config.productName).toBe('Orca')
    expect(config.extraMetadata).toEqual({ version: '1.4.214-local.1.abc' })
  })

  it('gives the fork identity its own bundle id and userData-deriving package name', () => {
    const config = loadConfigWithEnv({
      ORCA_PACKAGED_APP_IDENTITY: 'fork',
      ORCA_LOCAL_BUILD_VERSION: '1.4.214-local.1.abc'
    })
    expect(config.appId).toBe('com.mikeboensel.orca')
    expect(config.productName).toBe('Orca Fork')
    expect(config.extraMetadata).toEqual({
      name: 'orca-fork',
      productName: 'Orca Fork',
      version: '1.4.214-local.1.abc'
    })
  })

  it('rejects an unknown identity', () => {
    expect(() => loadConfigWithEnv({ ORCA_PACKAGED_APP_IDENTITY: 'official' })).toThrow(
      'Unknown ORCA_PACKAGED_APP_IDENTITY official; expected one of upstream, fork'
    )
  })

  it.each([
    { ORCA_MAC_RELEASE: '1' },
    { ORCA_MAC_DAILY: '1' },
    { ORCA_WIN_HOURLY: '1' },
    { ORCA_LINUX_ARM64_RELEASE: '1' }
  ])('rejects the fork identity on release channel %o', (channelEnv) => {
    expect(() => loadConfigWithEnv({ ORCA_PACKAGED_APP_IDENTITY: 'fork', ...channelEnv })).toThrow(
      'ORCA_PACKAGED_APP_IDENTITY=fork is only valid for local builds'
    )
  })
})
