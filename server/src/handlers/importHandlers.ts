import type { RequestHandler } from 'express'

import { ApiError } from '../errors'
import type { ImportService } from '../services/ImportTemplateService'

export function createImportHandlers(service: ImportService) {
  const create: RequestHandler = async (request, response) => {
    if (!request.is('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
      throw new ApiError(
        415,
        'unsupported_media_type',
        'Content-Type must be application/vnd.openxmlformats-officedocument.presentationml.presentation.',
      )
    }
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new ApiError(400, 'missing_powerpoint', 'A PowerPoint file is required in the request body.')
    }

    const result = await service.import(request.body)
    if (response.writableEnded) {
      return
    }
    response
      .status(201)
      .set({
        Location: `/templates/${result.templateId}`,
        'X-PowerPoint-Warning-Count': String(result.warnings.length),
        'X-Template-Id': result.templateId,
      })
      .json(result.templateJson)
  }

  const find: RequestHandler<{ templateId: string }> = (request, response) => {
    const template = service.find(request.params.templateId)
    if (!template) {
      throw new ApiError(404, 'template_not_found', 'The requested template does not exist.')
    }
    response.json(template.templateJson)
  }

  const findAsset: RequestHandler<{ assetId: string; templateId: string }> = (request, response) => {
    const asset = service.findAsset(request.params.templateId, request.params.assetId)
    if (!asset) {
      throw new ApiError(404, 'template_asset_not_found', 'The requested template image does not exist.')
    }

    response
      .status(200)
      .set({
        'Cache-Control': 'no-store',
        'Content-Length': String(asset.bytes.length),
        'Content-Type': asset.contentType,
        'X-Content-Type-Options': 'nosniff',
      })
      .send(asset.bytes)
  }

  const list: RequestHandler = (_request, response) => {
    response.json(service.list())
  }

  const remove: RequestHandler<{ templateId: string }> = (request, response) => {
    if (!service.delete(request.params.templateId)) {
      throw new ApiError(404, 'template_not_found', 'The requested template does not exist.')
    }
    response.sendStatus(204)
  }

  return { create, find, findAsset, list, remove }
}
