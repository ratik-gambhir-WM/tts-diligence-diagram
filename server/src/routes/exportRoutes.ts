import { json, Router } from 'express'

import { createExportHandlers } from '../handlers/exportHandlers'
import type { ExportPowerPointUseCase } from '../services/ExportPowerPointService'

export function createExportRouter(service: ExportPowerPointUseCase, maxJsonBytes: number) {
  const router = Router()
  const handlers = createExportHandlers(service)

  router.post(
    '/',
    json({ inflate: false, limit: maxJsonBytes, strict: true, type: 'application/json' }),
    handlers.create,
  )

  return router
}
