import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { ApiError } from '../errors'
import type {
  PowerPointCanvasElement,
  PowerPointCanvasJson,
} from '../lib/import/PowerpointImportTypes'
import type { TemplateKind, TemplateRepository } from '../repositories/TemplateRepository'
import type { PowerPointConverter } from './PowerPointConverter'
import {
  DisabledTemplatePreviewGenerator,
  type TemplatePreviewGenerator,
} from './TemplatePreview'
import {
  externalizeTemplateAssets,
  hydrateCanvasTemplateAssetSources,
} from './TemplateAssets'

export type TemplateListItem = {
  description: string
  elementCount: number
  kind: TemplateKind
  previewUrl: string | null
  slideCount: number
  templateId: string
  title: string
}

export type TemplateListResponse = {
  templates: TemplateListItem[]
}

export class ImportService {
  constructor(
    private readonly converter: PowerPointConverter,
    private readonly templates: TemplateRepository,
    private readonly createTemplateId: () => string = randomUUID,
    private readonly createAssetId: () => string = randomUUID,
    private readonly previewGenerator: TemplatePreviewGenerator = new DisabledTemplatePreviewGenerator(),
  ) {}

  async import(source: Buffer, kind: TemplateKind = 'diagram', signal?: AbortSignal) {
    const workingDirectory = await mkdtemp(path.join(tmpdir(), 'tts-mermaid-import-'))
    const inputPath = path.join(workingDirectory, 'upload.pptx')
    const outputPath = path.join(workingDirectory, 'upload.canvas.json')
    const previewDirectory = path.join(workingDirectory, 'preview')

    try {
      await writeFile(inputPath, source)
      await mkdir(previewDirectory)
      const conversion = await this.converter.convertFile(inputPath, outputPath)
      if (conversion.templateJson.presentation.slides.length !== 1) {
        throw new ApiError(
          422,
          'template_must_have_one_slide',
          'Template PowerPoint files must contain exactly one slide.',
        )
      }
      const { templateJson: repairedTemplateJson } = repairCanvasDimensions(conversion.templateJson)
      const preview = await this.previewGenerator.generate({
        inputPath,
        outputDirectory: previewDirectory,
        templateJson: repairedTemplateJson,
      }, signal)
      if (signal?.aborted) {
        throw new ApiError(499, 'request_cancelled', 'The template import was cancelled.')
      }
      const warnings = preview
        ? conversion.warnings
        : [...conversion.warnings, 'A preview image could not be generated for this template.']
      const templateId = this.createTemplateId()
      const externalized = externalizeTemplateAssets(
        templateId,
        repairedTemplateJson,
        this.createAssetId,
      )
      const template = {
        templateId,
        templateJson: externalized.templateJson,
      }
      this.templates.insert(
        template,
        externalized.assets,
        {
          checksum: null,
          createdAt: new Date().toISOString(),
          description: 'Imported PowerPoint template',
          kind,
          source: 'import',
          templateId,
        },
        preview ? { ...preview, templateId } : undefined,
      )

      return {
        previewAvailable: preview !== undefined,
        templateId,
        templateJson: hydrateCanvasTemplateAssetSources(
          externalized.templateJson,
          externalized.assets,
        ),
        warnings,
      }
    } finally {
      await rm(workingDirectory, { force: true, recursive: true })
    }
  }

  find(templateId: string) {
    const storedTemplate = this.templates.findByIdWithAssets(templateId)
    if (!storedTemplate) {
      return undefined
    }

    const externalized = externalizeTemplateAssets(
      templateId,
      storedTemplate.templateJson,
      this.createAssetId,
    )
    const repaired = repairCanvasDimensions(externalized.templateJson)
    let templateJson = repaired.templateJson
    let assets = storedTemplate.assets
    if (repaired.repaired || externalized.assets.length > 0) {
      assets = [...assets, ...externalized.assets]
      this.templates.update({ templateId, templateJson }, externalized.assets)
    }

    return {
      templateId,
      templateJson: hydrateCanvasTemplateAssetSources(templateJson, assets),
    }
  }

  findAsset(templateId: string, assetId: string) {
    return this.templates.findAsset(templateId, assetId)
  }

  findPreview(templateId: string) {
    return this.templates.findPreview(templateId)
  }

  list(kind?: TemplateKind): TemplateListResponse {
    return {
      templates: this.templates.list(kind).map(({ metadata, previewAvailable, templateId, templateJson }) => ({
        description: metadata.description,
        kind: metadata.kind,
        previewUrl: previewAvailable ? `/templates/${templateId}/preview` : null,
        templateId,
        title: templateJson.presentation.title,
        slideCount: templateJson.presentation.slides.length,
        elementCount: templateJson.presentation.slides.reduce(
          (count, slide) => count + slide.elements.length,
          0,
        ),
      })),
    }
  }

  delete(templateId: string) {
    return this.templates.delete(templateId)
  }
}

export { ImportService as ImportTemplateService }

function repairCanvasDimensions(templateJson: PowerPointCanvasJson): {
  repaired: boolean
  templateJson: PowerPointCanvasJson
} {
  let repaired = false
  const positiveDimension = (value: number) => {
    if (value > 0) {
      return value
    }
    repaired = true
    return 1
  }
  const repairElement = (element: PowerPointCanvasElement): PowerPointCanvasElement => {
    if (element.type === 'line') {
      return element
    }

    const w = positiveDimension(element.w)
    const h = positiveDimension(element.h)
    return w === element.w && h === element.h ? element : { ...element, w, h }
  }

  const slides = templateJson.presentation.slides.map((slide) => {
    const width = positiveDimension(slide.width)
    const height = positiveDimension(slide.height)
    const elements = slide.elements.map(repairElement)
    return width === slide.width
      && height === slide.height
      && elements.every((element, index) => element === slide.elements[index])
      ? slide
      : { ...slide, width, height, elements }
  })

  return {
    repaired,
    templateJson: repaired
      ? {
          ...templateJson,
          presentation: { ...templateJson.presentation, slides },
        }
      : templateJson,
  }
}
