import type { PowerPointCanvasJson } from '../../../src/lib/import/PowerpointImportTypes'

export type StoredTemplate = {
  templateId: string
  templateJson: PowerPointCanvasJson
}

export type TemplateAsset = {
  assetId: string
  bytes: Buffer
  contentType: string
  templateId: string
}

export type StoredTemplateWithAssets = StoredTemplate & {
  assets: TemplateAsset[]
}

export interface TemplateRepository {
  findAsset(templateId: string, assetId: string): TemplateAsset | undefined
  findById(templateId: string): StoredTemplate | undefined
  findByIdWithAssets(templateId: string): StoredTemplateWithAssets | undefined
  insert(template: StoredTemplate, assets: readonly TemplateAsset[]): void
  update(template: StoredTemplate, assets: readonly TemplateAsset[]): void
}
