import { Router, raw } from 'express'

import { createImportHandlers } from '../handlers/importHandlers'
import type { ImportTemplateService } from '../services/ImportTemplateService'

const POWERPOINT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function createImportRouter(service: ImportTemplateService, maxUploadBytes: number) {
  const router = Router()
  const handlers = createImportHandlers(service)

  router.post(
    '/',
    raw({ inflate: false, limit: maxUploadBytes, type: POWERPOINT_CONTENT_TYPE }),
    handlers.create,
  )
  router.get('/:templateId/assets/:assetId', handlers.findAsset)
  router.get('/:templateId', handlers.find)

  return router
}
