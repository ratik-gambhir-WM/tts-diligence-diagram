import { isIP } from 'node:net'
import path from 'node:path'

export type ServerConfig = {
  databasePath: string
  host: string
  maxExportJsonBytes: number
  maxUploadBytes: number
  port: number
  requestTimeoutMs: number
}

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const DEFAULT_MAX_EXPORT_JSON_BYTES = 50 * 1024 * 1024
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    databasePath: path.resolve(environment.SQLITE_DB_PATH ?? 'data/templates.sqlite'),
    host: parseHost(environment.HOST),
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
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

function parsePort(value: string | undefined) {
  if (value === undefined) {
    return 3001
  }
  const port = parseUnsignedInteger(value)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be between 1 and 65535.')
  }
  return port
}

function parseHost(value: string | undefined) {
  const host = value ?? '0.0.0.0'
  if (isIP(host) === 0) {
    throw new Error('HOST must be an IP address.')
  }
  return host
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) {
    return fallback
  }

  const parsed = parseUnsignedInteger(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive whole number.`)
  }
  return parsed
}

function parseUnsignedInteger(value: string) {
  return /^\+?\d+$/.test(value) ? Number(value) : Number.NaN
}
