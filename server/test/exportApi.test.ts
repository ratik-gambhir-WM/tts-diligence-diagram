// @vitest-environment node

import JSZip from 'jszip'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import { SqliteTemplateRepository } from '../src/repositories/SqliteTemplateRepository'
import { ExportPowerPointService } from '../src/services/ExportPowerPointService'
import { ImportTemplateService } from '../src/services/ImportTemplateService'
import { LibraryPowerPointConverter } from '../src/services/PowerPointConverter'
import type { JsonObject } from '../src/lib/shared/PowerpointTypes'

const POWERPOINT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

let templates: SqliteTemplateRepository

beforeEach(() => {
  templates = new SqliteTemplateRepository(':memory:')
})

afterEach(() => {
  templates.close()
})

describe('export API', () => {
  it('normalizes compact canvas JSON and returns PowerPoint bytes', async () => {
    const app = createTestApp(1024 * 1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send(createCompactPresentation())
      .buffer(true)
      .parse((incoming, callback) => {
        const chunks: Buffer[] = []
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
        incoming.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)

    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="export-api-deck.pptx"',
      'content-type': POWERPOINT_CONTENT_TYPE,
      'x-powerpoint-warning-count': '0',
    })
    expect(Buffer.isBuffer(response.body)).toBe(true)
    expect(response.body.subarray(0, 2).toString()).toBe('PK')

    const zip = await JSZip.loadAsync(response.body)
    const presentationXml = await zip.file('ppt/presentation.xml')?.async('text')
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text')
    const slideMasterXml = await zip.file('ppt/slideMasters/slideMaster1.xml')?.async('text')
    expect(presentationXml).toContain('<p:sldId')
    expect(slideXml).toContain('Exported by the API')
    expect(slideXml).toContain('prst="flowChartMagneticDisk"')
    expect(slideXml).not.toContain('prst="flowchartmagneticdisk"')
    expect(slideMasterXml).toContain('<p:sldLayoutId id="2147483649" r:id="rId1"/>')
  })

  it('rejects non-JSON request bodies', async () => {
    const app = createTestApp(1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'text/plain')
      .send('{}')
      .expect(415)

    expect(response.body.error.code).toBe('unsupported_media_type')
  })

  it('rejects compressed bodies before checking their media type', async () => {
    const app = createTestApp(1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'text/plain')
      .set('Content-Encoding', 'gzip')
      .send('{}')
      .expect(415)

    expect(response.body.error.code).toBe('unsupported_content_encoding')
  })

  it('rejects malformed JSON with a stable error', async () => {
    const app = createTestApp(1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send('{"presentation":')
      .expect(400)

    expect(response.body.error).toMatchObject({
      code: 'invalid_json',
      requestId: expect.any(String),
    })
  })

  it('rejects an empty JSON body before presentation normalization', async () => {
    const app = createTestApp(1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send()
      .expect(400)

    expect(response.body.error.code).toBe('invalid_json')
  })

  it('rejects presentation JSON that cannot be normalized', async () => {
    const app = createTestApp(1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send({ unrelated: true })
      .expect(422)

    expect(response.body.error.code).toBe('invalid_presentation_json')
  })

  it('parses valid primitive JSON before rejecting its presentation shape', async () => {
    const app = createTestApp(1024)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(422)

    expect(response.body.error.code).toBe('invalid_presentation_json')
  })

  it('does not allow image paths or remote URLs to reach the server-side renderer', async () => {
    const app = createTestApp(4096)
    const presentation = createCompactPresentation('/etc/passwd')

    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send(presentation)
      .expect(422)

    expect(response.body.error.code).toBe('unsupported_image_source')
    expect(JSON.stringify(response.body)).not.toContain('/etc/passwd')
  })

  it('enforces the configured JSON body limit', async () => {
    const app = createTestApp(64)
    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send(createCompactPresentation())
      .expect(413)

    expect(response.body.error.code).toBe('payload_too_large')
  })

  it('returns an empty 408 response when endpoint work exceeds the request timeout', async () => {
    const app = createApp({
      exportService: {
        export: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return { bytes: new Uint8Array(), fileName: 'late.pptx', warnings: [] }
        },
      },
      importService: new ImportTemplateService(new LibraryPowerPointConverter(), templates),
      maxExportJsonBytes: 1024 * 1024,
      maxUploadBytes: 1024,
      requestTimeoutMs: 10,
    })

    const response = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send(createCompactPresentation())
      .expect(408)

    expect(response.headers['x-request-id']).toEqual(expect.any(String))
    expect(response.text).toBe('')
  })

  it('returns the stable route-not-found envelope with a request ID', async () => {
    const response = await request(createTestApp(1024)).get('/missing').expect(404)

    expect(response.body.error).toMatchObject({
      code: 'route_not_found',
      requestId: expect.any(String),
    })
  })

  it('returns an empty 405 for a known path with the wrong HTTP method', async () => {
    const response = await request(createTestApp(1024)).get('/export').expect(405)

    expect(response.headers['x-request-id']).toEqual(expect.any(String))
    expect(response.text).toBe('')
  })
})

function createTestApp(maxExportJsonBytes: number) {
  return createApp({
    exportService: new ExportPowerPointService(templates),
    importService: new ImportTemplateService(new LibraryPowerPointConverter(), templates),
    maxExportJsonBytes,
    maxUploadBytes: 1024,
  })
}

function createCompactPresentation(imageSource?: string) {
  const elements: JsonObject[] = [
    {
      id: 'title',
      type: 'text',
      x: 80,
      y: 80,
      w: 500,
      h: 80,
      text: 'Exported by the API',
      fontSize: 30,
      textColor: '070154',
    },
    {
      id: 'database',
      type: 'shape',
      shape: 'flowChartMagneticDisk',
      x: 80,
      y: 180,
      w: 120,
      h: 80,
      fill: 'E8EEF8',
      stroke: '070154',
      strokeWidth: 1,
    },
  ]
  if (imageSource) {
    elements.push({
      id: 'unsafe-image',
      type: 'image',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      src: imageSource,
    })
  }

  return {
    presentation: {
      title: 'Export API Deck',
      preserveElementOrder: true,
      showBranding: false,
      slides: [
        {
          id: 'slide-1',
          name: 'Exported slide',
          width: 1280,
          height: 720,
          backgroundColor: 'FFFFFF',
          elements,
        },
      ],
    },
  }
}
