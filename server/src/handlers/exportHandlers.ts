import { TextDecoder } from 'node:util'

import type { RequestHandler } from 'express'

import { ApiError } from '../errors'
import type { ExportPowerPointUseCase } from '../services/ExportPowerPointService'

const POWERPOINT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function createExportHandlers(service: ExportPowerPointUseCase) {
  const create: RequestHandler = async (request, response) => {
    if (!request.is('application/json')) {
      throw new ApiError(
        415,
        'unsupported_media_type',
        'Content-Type must be application/json.',
      )
    }

    const result = await service.export(parseJsonBody(request.body))
    if (response.writableEnded) {
      return
    }
    const bytes = Buffer.from(result.bytes)
    response
      .status(200)
      .set({
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': String(bytes.length),
        'Content-Type': POWERPOINT_CONTENT_TYPE,
        'X-PowerPoint-Warning-Count': String(result.warnings.length),
      })
      .send(bytes)
  }

  return { create }
}

function parseJsonBody(body: unknown) {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw invalidJsonError()
  }

  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(body)
    return JSON.parse(json) as unknown
  } catch {
    throw invalidJsonError()
  }
}

function invalidJsonError() {
  return new ApiError(400, 'invalid_json', 'The request body must contain valid JSON.')
}
