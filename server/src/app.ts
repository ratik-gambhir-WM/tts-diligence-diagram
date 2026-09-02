import { randomUUID } from 'node:crypto'

import express from 'express'

import { errorHandler, notFoundHandler } from './errors'
import { createExportRouter } from './routes/exportRoutes'
import { createImportRouter } from './routes/importRoutes'
import type { ExportPowerPointUseCase } from './services/ExportPowerPointService'
import type { ImportTemplateService } from './services/ImportTemplateService'

export type AppDependencies = {
  exportService: ExportPowerPointUseCase
  importService: ImportTemplateService
  maxExportJsonBytes: number
  maxUploadBytes: number
}

export function createApp(dependencies: AppDependencies) {
  const app = express()
  app.disable('x-powered-by')

  app.use((_request, response, next) => {
    const requestId = randomUUID()
    response.locals.requestId = requestId
    response.setHeader('X-Request-Id', requestId)
    next()
  })
  app.use('/export', createExportRouter(dependencies.exportService, dependencies.maxExportJsonBytes))
  app.use('/import', createImportRouter(dependencies.importService, dependencies.maxUploadBytes))
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
