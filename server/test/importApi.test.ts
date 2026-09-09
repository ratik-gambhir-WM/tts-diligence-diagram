// @vitest-environment node

import PptxGenJS from 'pptxgenjs'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import { SqliteTemplateRepository } from '../src/repositories/SqliteTemplateRepository'
import { ExportPowerPointService } from '../src/services/ExportPowerPointService'
import { ImportTemplateService } from '../src/services/ImportTemplateService'
import { LibraryPowerPointConverter } from '../src/services/PowerPointConverter'
import type { PowerPointCanvasJson } from '../../src/lib/import/PowerpointImportTypes'

const POWERPOINT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

let templates: SqliteTemplateRepository

beforeEach(() => {
  templates = new SqliteTemplateRepository(':memory:')
})

afterEach(() => {
  templates.close()
})

describe('import API', () => {
  it('stores compact image references and retrieves canvas JSON with hydrated image data', async () => {
    const importService = new ImportTemplateService(
      new LibraryPowerPointConverter(),
      templates,
      () => 'template-123',
      () => 'asset-456',
    )
    const app = createTestApp(importService, 1024 * 1024)
    const source = await createPowerPoint()

    const imported = await request(app)
      .post('/import')
      .set('Content-Type', POWERPOINT_CONTENT_TYPE)
      .send(source)
      .expect(201)

    expect(imported.headers).toMatchObject({
      location: '/templates/template-123',
      'x-powerpoint-warning-count': '0',
      'x-request-id': expect.any(String),
      'x-template-id': 'template-123',
    })
    expect(Object.keys(imported.body)).toEqual(['presentation'])
    expect(imported.body).toMatchObject({
      presentation: {
        preserveElementOrder: true,
        showBranding: false,
        slides: [
          {
            id: 'slide-1',
            elements: [
              expect.objectContaining({
                type: 'text',
                text: 'Stored by the import API',
              }),
              expect.objectContaining({
                type: 'image',
                src: expect.stringMatching(/^data:image\/png;base64,/u),
              }),
            ],
          },
        ],
      },
    })
    expect(templates.findById('template-123')?.templateJson.presentation.slides[0]?.elements[1])
      .toMatchObject({ src: '/import/template-123/assets/asset-456' })

    const listed = await request(app).get('/templates').expect(200)
    expect(listed.body).toEqual({
      templates: [{
        templateId: 'template-123',
        title: expect.any(String),
        slideCount: 1,
        elementCount: 2,
      }],
    })

    const retrieved = await request(app).get('/templates/template-123').expect(200)
    expect(Object.keys(retrieved.body)).toEqual(['presentation'])
    expect(retrieved.body).toMatchObject({
      presentation: {
        slides: [
          {
            elements: [
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image',
                src: expect.stringMatching(/^data:image\/png;base64,/u),
              }),
            ],
          },
        ],
      },
    })
    expect(JSON.stringify(retrieved.body)).toContain('base64')

    const legacyAlias = await request(app).get('/import/template-123').expect(200)
    expect(legacyAlias.body).toEqual(retrieved.body)

    const image = await request(app)
      .get('/import/template-123/assets/asset-456')
      .buffer(true)
      .parse((incoming, callback) => {
        const chunks: Buffer[] = []
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
        incoming.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(image.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'image/png',
      'x-content-type-options': 'nosniff',
    })
    expect(Buffer.isBuffer(image.body)).toBe(true)
    expect(image.body.subarray(1, 4).toString()).toBe('PNG')

    const exported = await request(app)
      .post('/export')
      .set('Content-Type', 'application/json')
      .send(retrieved.body)
      .buffer(true)
      .parse((incoming, callback) => {
        const chunks: Buffer[] = []
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
        incoming.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(exported.headers['content-type']).toBe(POWERPOINT_CONTENT_TYPE)
    expect(exported.body.subarray(0, 2).toString()).toBe('PK')
  })

  it('rejects unsupported media types before conversion', async () => {
    const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
    const app = createTestApp(importService, 1024)

    const response = await request(app)
      .post('/import')
      .set('Content-Type', 'application/xml')
      .send('<presentation />')
      .expect(415)

    expect(response.body.error).toMatchObject({
      code: 'unsupported_media_type',
      message: expect.any(String),
      requestId: expect.any(String),
    })
  })

  it('returns a sanitized validation error for a malformed package', async () => {
    const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
    const app = createTestApp(importService, 1024)

    const response = await request(app)
      .post('/import')
      .set('Content-Type', POWERPOINT_CONTENT_TYPE)
      .send(Buffer.from('not a zip'))
      .expect(422)

    expect(response.body.error).toMatchObject({
      code: 'invalid_powerpoint',
      message: 'The uploaded file is not a supported PowerPoint OOXML presentation.',
    })
    expect(JSON.stringify(response.body)).not.toContain('not a zip')
  })

  it('enforces the configured upload limit', async () => {
    const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
    const app = createTestApp(importService, 4)

    const response = await request(app)
      .post('/import')
      .set('Content-Type', POWERPOINT_CONTENT_TYPE)
      .send(Buffer.from('oversized'))
      .expect(413)

    expect(response.body.error.code).toBe('payload_too_large')
  })

  it('returns a stable not-found error for an unknown template ID', async () => {
    const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
    const app = createTestApp(importService, 1024)

    const response = await request(app).get('/import/missing').expect(404)
    expect(response.body.error.code).toBe('template_not_found')
  })

  it('does not expose an image outside its owning template', async () => {
    const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
    const app = createTestApp(importService, 1024)

    const response = await request(app)
      .get('/import/missing/assets/missing')
      .expect(404)
    expect(response.body.error.code).toBe('template_asset_not_found')
  })

  it('returns a stable error when stored JSON references a missing joined asset', async () => {
    const missingAssetTemplate = createLegacyTemplate()
    const image = missingAssetTemplate.presentation.slides[0]?.elements[0]
    if (!image || image.type !== 'image') {
      throw new Error('Expected the test template to contain an image.')
    }
    image.src = '/import/orphan-template/assets/missing-asset'
    templates.insert({
      templateId: 'orphan-template',
      templateJson: missingAssetTemplate,
    }, [])
    const importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates)
    const app = createTestApp(importService, 1024)

    const response = await request(app).get('/import/orphan-template').expect(422)
    expect(response.body.error.code).toBe('template_asset_not_found')
  })

  it('migrates legacy embedded images when a stored template is first retrieved', async () => {
    templates.insert({
      templateId: 'legacy-template',
      templateJson: createLegacyTemplate(),
    }, [])
    const importService = new ImportTemplateService(
      new LibraryPowerPointConverter(),
      templates,
      () => 'unused-template-id',
      () => 'migrated-asset',
    )
    const app = createTestApp(importService, 1024)

    const response = await request(app).get('/import/legacy-template').expect(200)
    expect(response.body.presentation.slides[0].elements[0]).toMatchObject({
      type: 'image',
      src: expect.stringMatching(/^data:image\/png;base64,/u),
    })
    expect(JSON.stringify(response.body)).toContain('base64')

    const stored = templates.findById('legacy-template')
    expect(JSON.stringify(stored)).not.toContain('base64')
    expect(stored?.templateJson.presentation.slides[0]?.elements[0]).toMatchObject({
      src: '/import/legacy-template/assets/migrated-asset',
    })
    await request(app)
      .get('/import/legacy-template/assets/migrated-asset')
      .expect('Content-Type', 'image/png')
      .expect(200)
  })

  it('repairs legacy non-positive canvas dimensions and persists the migration', async () => {
    const templateJson = createLegacyTemplate()
    const slide = templateJson.presentation.slides[0]
    const image = slide?.elements[0]
    if (!slide || !image || image.type !== 'image') {
      throw new Error('Expected a slide with an image in the legacy fixture.')
    }
    slide.width = 0
    slide.height = -1
    image.w = 0
    image.h = -2
    templates.insert({ templateId: 'zero-sized-template', templateJson }, [])
    const app = createTestApp(
      new ImportTemplateService(
        new LibraryPowerPointConverter(),
        templates,
        () => 'unused-template-id',
        () => 'repaired-asset',
      ),
      1024,
    )

    const response = await request(app).get('/templates/zero-sized-template').expect(200)
    expect(response.body.presentation.slides[0]).toMatchObject({ width: 1, height: 1 })
    expect(response.body.presentation.slides[0].elements[0]).toMatchObject({ w: 1, h: 1 })
    expect(templates.findById('zero-sized-template')?.templateJson.presentation.slides[0])
      .toMatchObject({ width: 1, height: 1 })
  })

  it('lists newest templates first and deletes templates with their assets', async () => {
    const first = createLegacyTemplate()
    first.presentation.title = 'First template'
    const firstSlide = first.presentation.slides[0]
    if (!firstSlide) {
      throw new Error('Expected a slide fixture.')
    }
    firstSlide.elements = []
    const second = createLegacyTemplate()
    second.presentation.title = 'Second template'
    const image = second.presentation.slides[0]?.elements[0]
    if (!image || image.type !== 'image') {
      throw new Error('Expected an image fixture.')
    }
    image.src = '/import/template-second/assets/asset-second'
    templates.insert({ templateId: 'template-first', templateJson: first }, [])
    templates.insert(
      { templateId: 'template-second', templateJson: second },
      [{
        assetId: 'asset-second',
        templateId: 'template-second',
        contentType: 'image/png',
        bytes: Buffer.from([1, 2, 3]),
      }],
    )
    const app = createTestApp(
      new ImportTemplateService(new LibraryPowerPointConverter(), templates),
      1024,
    )

    const listed = await request(app).get('/templates').expect(200)
    expect(listed.body).toEqual({
      templates: [
        {
          templateId: 'template-second',
          title: 'Second template',
          slideCount: 1,
          elementCount: 1,
        },
        {
          templateId: 'template-first',
          title: 'First template',
          slideCount: 1,
          elementCount: 0,
        },
      ],
    })

    const deleted = await request(app).delete('/templates/template-second').expect(204)
    expect(deleted.headers['x-request-id']).toEqual(expect.any(String))
    expect(deleted.text).toBe('')
    expect(templates.findById('template-second')).toBeUndefined()
    expect(templates.findAsset('template-second', 'asset-second')).toBeUndefined()

    const repeated = await request(app).delete('/templates/template-second').expect(404)
    expect(repeated.body.error.code).toBe('template_not_found')
  })
})

function createTestApp(importService: ImportTemplateService, maxUploadBytes: number) {
  return createApp({
    exportService: new ExportPowerPointService(templates),
    importService,
    maxExportJsonBytes: 1024,
    maxUploadBytes,
  })
}

async function createPowerPoint() {
  const presentation = new PptxGenJS()
  presentation.layout = 'LAYOUT_WIDE'
  const slide = presentation.addSlide()
  slide.addText('Stored by the import API', {
    x: 0.5,
    y: 0.5,
    w: 4,
    h: 0.5,
  })
  slide.addImage({
    data: ONE_PIXEL_PNG,
    x: 0.5,
    y: 1.5,
    w: 1,
    h: 1,
  })
  const output = await presentation.write({ outputType: 'nodebuffer' })
  if (!Buffer.isBuffer(output)) {
    throw new Error('Expected PptxGenJS to return a Node.js buffer.')
  }
  return output
}

function createLegacyTemplate(): PowerPointCanvasJson {
  return {
    presentation: {
      title: 'Legacy template',
      preserveElementOrder: true,
      showBranding: false,
      slides: [
        {
          id: 'slide-1',
          name: 'Legacy slide',
          width: 1280,
          height: 720,
          backgroundColor: 'FFFFFF',
          elements: [
            {
              id: 'legacy-image',
              type: 'image',
              x: 0,
              y: 0,
              w: 100,
              h: 100,
              src: ONE_PIXEL_PNG,
              fit: 'contain',
            },
          ],
        },
      ],
    },
  }
}
