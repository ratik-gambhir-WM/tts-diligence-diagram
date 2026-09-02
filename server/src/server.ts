import { createServer } from 'node:http'

import { createApp } from './app'
import { loadServerConfig } from './config'
import { SqliteTemplateRepository } from './repositories/SqliteTemplateRepository'
import { ExportPowerPointService } from './services/ExportPowerPointService'
import { ImportTemplateService } from './services/ImportTemplateService'
import { LibraryPowerPointConverter } from './services/PowerPointConverter'

const config = loadServerConfig()
const templates = new SqliteTemplateRepository(config.databasePath)
const exportService = new ExportPowerPointService(templates)
const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
const server = createServer(createApp({
  exportService,
  importService,
  maxExportJsonBytes: config.maxExportJsonBytes,
  maxUploadBytes: config.maxUploadBytes,
}))

server.listen(config.port, () => {
  console.log(`PowerPoint API listening on port ${config.port}.`)
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  const forceCloseTimer = setTimeout(() => {
    server.closeAllConnections()
  }, 10_000)
  forceCloseTimer.unref()

  server.close((error) => {
    clearTimeout(forceCloseTimer)
    templates.close()
    if (error) {
      console.error('The PowerPoint API did not shut down cleanly.')
      process.exitCode = 1
    }
  })
  server.closeIdleConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
