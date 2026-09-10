import { randomUUID } from 'node:crypto'

import express from 'express'

import { ApiError, errorHandler, notFoundHandler } from './errors'
import { createExportRouter } from './routes/exportRoutes'
import { createBatchImportRouter, createImportRouter } from './routes/importRoutes'
import { createTemplateRouter } from './routes/templateRoutes'
import type { ExportPowerPointUseCase } from './services/ExportPowerPointService'
import type { ImportService } from './services/ImportTemplateService'

export type AppDependencies = {
  exportService: ExportPowerPointUseCase
  importService: ImportService
  maxExportJsonBytes: number
  maxUploadBytes: number
  requestTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export function createApp(dependencies: AppDependencies) {
  const app = express()
  app.disable('x-powered-by')

  app.use((_request, response, next) => {
    const requestId = randomUUID()
    response.locals.requestId = requestId
    response.setHeader('X-Request-Id', requestId)
    next()
  })
  app.use((request, response, next) => {
    const contentEncoding = request.get('Content-Encoding')
    if (contentEncoding && contentEncoding.toLowerCase() !== 'identity') {
      throw new ApiError(
        415,
        'unsupported_content_encoding',
        'Compressed request bodies are not supported.',
      )
    }

    response.setTimeout(dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, () => {
      if (!response.headersSent) {
        response.status(408).end()
      }
    })
    next()
  })
  app.use('/export', createExportRouter(
    dependencies.exportService,
    dependencies.maxExportJsonBytes,
    dependencies.maxUploadBytes,
  ))
  app.use('/import', createImportRouter(dependencies.importService, dependencies.maxUploadBytes))
  app.use(
    '/batchImport',
    createBatchImportRouter(dependencies.importService, dependencies.maxUploadBytes),
  )
  app.use('/templates', createTemplateRouter(dependencies.importService))
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
