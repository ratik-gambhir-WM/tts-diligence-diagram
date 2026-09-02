import type {
  PowerPointCanvasImageElement,
  PowerPointCanvasJson,
} from '../../../src/lib/import/PowerpointImportTypes'
import type { NormalizedPresentation } from '../../../src/lib/shared/PowerpointTypes'
import { ApiError } from '../errors'
import type { TemplateAsset, TemplateRepository } from '../repositories/TemplateRepository'

const DATA_IMAGE_PATTERN =
  /^data:(image\/(?:png|jpeg|jpg|gif|svg\+xml|emf));base64,([a-z0-9+/]*={0,2})$/iu
const TEMPLATE_ASSET_PATH_PATTERN =
  /^\/import\/([a-z0-9_-]{1,128})\/assets\/([a-z0-9_-]{1,128})$/iu

export function externalizeTemplateAssets(
  templateId: string,
  templateJson: PowerPointCanvasJson,
  createAssetId: () => string,
) {
  const assets: TemplateAsset[] = []
  const assetBySource = new Map<string, TemplateAsset>()

  const slides = templateJson.presentation.slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map((element) => {
      if (element.type !== 'image') {
        return element
      }
      if (parseTemplateAssetPath(element.src)) {
        return element
      }

      const existingAsset = assetBySource.get(element.src)
      const asset = existingAsset ?? createTemplateAsset(templateId, element, createAssetId())
      if (!existingAsset) {
        assetBySource.set(element.src, asset)
        assets.push(asset)
      }

      return {
        ...element,
        src: buildTemplateAssetPath(asset.templateId, asset.assetId),
      }
    }),
  }))

  return {
    assets,
    templateJson: {
      ...templateJson,
      presentation: {
        ...templateJson.presentation,
        slides,
      },
    },
  }
}

export function hydrateTemplateAssetSources(
  presentation: NormalizedPresentation,
  templates: TemplateRepository,
) {
  return {
    ...presentation,
    slides: presentation.slides.map((slide) => ({
      ...slide,
      elements: slide.elements.map((element) => {
        if (element.kind !== 'image') {
          return element
        }

        const reference = parseTemplateAssetPath(element.src)
        if (!reference) {
          return element
        }

        const asset = templates.findAsset(reference.templateId, reference.assetId)
        if (!asset) {
          throw new ApiError(
            422,
            'template_asset_not_found',
            'A referenced template image does not exist.',
          )
        }

        return { ...element, src: templateAssetDataUri(asset) }
      }),
    })),
  }
}

export function hydrateCanvasTemplateAssetSources(
  templateJson: PowerPointCanvasJson,
  assets: readonly TemplateAsset[],
): PowerPointCanvasJson {
  const assetsByReference = new Map(
    assets.map((asset) => [templateAssetKey(asset.templateId, asset.assetId), asset]),
  )

  return {
    ...templateJson,
    presentation: {
      ...templateJson.presentation,
      slides: templateJson.presentation.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((element) => {
          if (element.type !== 'image') {
            return element
          }

          const reference = parseTemplateAssetPath(element.src)
          if (!reference) {
            return element
          }

          const asset = assetsByReference.get(
            templateAssetKey(reference.templateId, reference.assetId),
          )
          if (!asset) {
            throw new ApiError(
              422,
              'template_asset_not_found',
              'A referenced template image does not exist.',
            )
          }

          return { ...element, src: templateAssetDataUri(asset) }
        }),
      })),
    },
  }
}

function createTemplateAsset(
  templateId: string,
  element: PowerPointCanvasImageElement,
  assetId: string,
): TemplateAsset {
  const match = DATA_IMAGE_PATTERN.exec(element.src)
  if (!match) {
    throw new ApiError(
      422,
      'unsupported_imported_image_source',
      'An imported image could not be stored safely.',
    )
  }

  const contentType = match[1]?.toLowerCase()
  const base64 = match[2]
  if (!contentType || !base64) {
    throw new ApiError(
      422,
      'invalid_imported_image',
      'An imported image did not contain valid image data.',
    )
  }

  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length === 0) {
    throw new ApiError(
      422,
      'invalid_imported_image',
      'An imported image did not contain valid image data.',
    )
  }

  return { assetId, bytes, contentType, templateId }
}

function buildTemplateAssetPath(templateId: string, assetId: string) {
  return `/import/${templateId}/assets/${assetId}`
}

function parseTemplateAssetPath(source: string) {
  const match = TEMPLATE_ASSET_PATH_PATTERN.exec(source)
  const templateId = match?.[1]
  const assetId = match?.[2]
  return templateId && assetId ? { assetId, templateId } : undefined
}

function templateAssetDataUri(asset: TemplateAsset) {
  return `data:${asset.contentType};base64,${asset.bytes.toString('base64')}`
}

function templateAssetKey(templateId: string, assetId: string) {
  return `${templateId}\u0000${assetId}`
}
