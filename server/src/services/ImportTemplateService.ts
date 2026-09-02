import { randomUUID } from 'node:crypto'

import type { TemplateRepository } from '../repositories/TemplateRepository'
import type { PowerPointConverter } from './PowerPointConverter'
import {
  externalizeTemplateAssets,
  hydrateCanvasTemplateAssetSources,
} from './TemplateAssets'

export class ImportTemplateService {
  constructor(
    private readonly converter: PowerPointConverter,
    private readonly templates: TemplateRepository,
    private readonly createTemplateId: () => string = randomUUID,
    private readonly createAssetId: () => string = randomUUID,
  ) {}

  async import(source: Buffer) {
    const conversion = await this.converter.convert(source)
    const templateId = this.createTemplateId()
    const externalized = externalizeTemplateAssets(
      templateId,
      conversion.templateJson,
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
    let templateJson = storedTemplate.templateJson
    let assets = storedTemplate.assets
    if (externalized.assets.length > 0) {
      templateJson = externalized.templateJson
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
}
