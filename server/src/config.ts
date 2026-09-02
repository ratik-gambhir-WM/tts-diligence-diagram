import path from 'node:path'

export type ServerConfig = {
  databasePath: string
  maxExportJsonBytes: number
  maxUploadBytes: number
  port: number
}

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const DEFAULT_MAX_EXPORT_JSON_BYTES = 50 * 1024 * 1024

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    databasePath: path.resolve(environment.SQLITE_DB_PATH ?? 'data/templates.sqlite'),
    maxExportJsonBytes: parsePositiveInteger(
      environment.MAX_EXPORT_JSON_BYTES,
      DEFAULT_MAX_EXPORT_JSON_BYTES,
      'MAX_EXPORT_JSON_BYTES',
    ),
    maxUploadBytes: parsePositiveInteger(
      environment.MAX_PPTX_UPLOAD_BYTES,
      DEFAULT_MAX_UPLOAD_BYTES,
      'MAX_PPTX_UPLOAD_BYTES',
    ),
    port: parsePort(environment.PORT),
  }
}

function parsePort(value: string | undefined) {
  const port = parsePositiveInteger(value, 3001, 'PORT')
  if (port > 65_535) {
    throw new Error('PORT must be between 1 and 65535.')
  }
  return port
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive whole number.`)
  }
  return parsed
}
