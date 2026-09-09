import type { PowerPointCanvasJson } from '../lib/import/PowerpointImportTypes'

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
  delete(templateId: string): boolean
  findAsset(templateId: string, assetId: string): TemplateAsset | undefined
  findById(templateId: string): StoredTemplate | undefined
  findByIdWithAssets(templateId: string): StoredTemplateWithAssets | undefined
  insert(template: StoredTemplate, assets: readonly TemplateAsset[]): void
  list(): StoredTemplate[]
  update(template: StoredTemplate, assets: readonly TemplateAsset[]): void
}
