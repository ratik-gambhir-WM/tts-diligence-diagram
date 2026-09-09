import { randomUUID } from 'node:crypto'

import type {
  PowerPointCanvasElement,
  PowerPointCanvasJson,
} from '../lib/import/PowerpointImportTypes'
import type { TemplateRepository } from '../repositories/TemplateRepository'
import type { PowerPointConverter } from './PowerPointConverter'
import {
  externalizeTemplateAssets,
  hydrateCanvasTemplateAssetSources,
} from './TemplateAssets'

export type TemplateListItem = {
  elementCount: number
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
  ) {}

  async import(source: Buffer) {
    const conversion = await this.converter.convert(source)
    const { templateJson: repairedTemplateJson } = repairCanvasDimensions(conversion.templateJson)
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
    this.templates.insert(template, externalized.assets)

    return {
      templateId,
      templateJson: hydrateCanvasTemplateAssetSources(
        externalized.templateJson,
        externalized.assets,
      ),
      warnings: conversion.warnings,
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

  list(): TemplateListResponse {
    return {
      templates: this.templates.list().map(({ templateId, templateJson }) => ({
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
