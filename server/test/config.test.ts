// @vitest-environment node

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { loadServerConfig } from '../src/config'

describe('server configuration', () => {
  it('uses explicit, validated values', () => {
    expect(loadServerConfig({
      MAX_EXPORT_JSON_BYTES: '8192',
      MAX_PPTX_UPLOAD_BYTES: '4096',
      HOST: '127.0.0.1',
      PORT: '4321',
      SQLITE_DB_PATH: './tmp/templates.sqlite',
    })).toEqual({
      databasePath: path.resolve('./tmp/templates.sqlite'),
      host: '127.0.0.1',
      maxExportJsonBytes: 8192,
      maxUploadBytes: 4096,
      port: 4321,
      requestTimeoutMs: 30_000,
    })
  })

  it('rejects invalid ports', () => {
    expect(() => loadServerConfig({ PORT: '0' })).toThrow('PORT must be between 1 and 65535.')
    expect(() => loadServerConfig({ PORT: '70000' })).toThrow('PORT must be between 1 and 65535.')
    expect(() => loadServerConfig({ PORT: '1e3' })).toThrow('PORT must be between 1 and 65535.')
  })

  it('uses the Rust server bind defaults and validates HOST as an IP address', () => {
    expect(loadServerConfig({})).toMatchObject({
      databasePath: fileURLToPath(new URL('../data/templates.sqlite', import.meta.url)),
      host: '0.0.0.0',
      port: 3001,
      requestTimeoutMs: 30_000,
    })
    expect(() => loadServerConfig({ HOST: 'localhost' })).toThrow('HOST must be an IP address.')
  })
})
