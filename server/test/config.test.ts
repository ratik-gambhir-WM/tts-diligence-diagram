// @vitest-environment node

import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadServerConfig } from '../src/config'

describe('server configuration', () => {
  it('uses explicit, validated values', () => {
    expect(loadServerConfig({
      MAX_EXPORT_JSON_BYTES: '8192',
      MAX_PPTX_UPLOAD_BYTES: '4096',
      PORT: '4321',
      SQLITE_DB_PATH: './tmp/templates.sqlite',
    })).toEqual({
      databasePath: path.resolve('./tmp/templates.sqlite'),
      maxExportJsonBytes: 8192,
      maxUploadBytes: 4096,
      port: 4321,
    })
  })

  it('rejects invalid ports', () => {
    expect(() => loadServerConfig({ PORT: '0' })).toThrow('PORT must be a positive whole number.')
    expect(() => loadServerConfig({ PORT: '70000' })).toThrow('PORT must be between 1 and 65535.')
  })
})
