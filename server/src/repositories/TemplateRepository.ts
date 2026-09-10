import type { PowerPointCanvasJson } from '../lib/import/PowerpointImportTypes'

export type StoredTemplate = {
  templateId: string
  templateJson: PowerPointCanvasJson
}

export type TemplateKind = 'commentary' | 'diagram'
export type TemplateSource = 'builtin' | 'import'

export type StoredTemplateMetadata = {
  checksum: string | null
  createdAt: string
  description: string
  kind: TemplateKind
  source: TemplateSource
  templateId: string
}

export type StoredTemplatePreview = {
  bytes: Buffer
  contentType: 'image/png'
  height: number
  templateId: string
  width: number
}

export type StoredTemplateSummary = StoredTemplate & {
  metadata: StoredTemplateMetadata
  previewAvailable: boolean
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

export type TemplateInsert = {
  assets: readonly TemplateAsset[]
  metadata?: StoredTemplateMetadata
  preview?: StoredTemplatePreview
  template: StoredTemplate
}

export interface TemplateRepository {
  delete(templateId: string): boolean
  findAsset(templateId: string, assetId: string): TemplateAsset | undefined
  findById(templateId: string): StoredTemplate | undefined
  findByIdWithAssets(templateId: string): StoredTemplateWithAssets | undefined
  findPreview(templateId: string): StoredTemplatePreview | undefined
  insert(
    template: StoredTemplate,
    assets: readonly TemplateAsset[],
    metadata?: StoredTemplateMetadata,
    preview?: StoredTemplatePreview,
  ): void
  insertMany(records: readonly TemplateInsert[]): void
  list(kind?: TemplateKind): StoredTemplateSummary[]
  upsertBuiltin(
    template: StoredTemplate,
    assets: readonly TemplateAsset[],
    metadata: StoredTemplateMetadata,
    preview: StoredTemplatePreview,
  ): void
  update(template: StoredTemplate, assets: readonly TemplateAsset[]): void
}
