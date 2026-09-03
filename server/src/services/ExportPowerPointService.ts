import {
  buildSuggestedFileName,
  buildThemedPptxBytes,
  normalizePresentationSpec,
} from '../../../src/lib/export/PowerpointGenerator'
import type {
  JsonValue,
  NormalizedPresentation,
} from '../../../src/lib/shared/PowerpointTypes'
import { ApiError } from '../errors'
import type { TemplateRepository } from '../repositories/TemplateRepository'
import { hydrateTemplateAssetSources } from './TemplateAssets'

const MAX_JSON_DEPTH = 100
const MAX_JSON_NODES = 100_000
const MAX_EMBEDDED_IMAGE_BYTES = 40 * 1024 * 1024
const BASE64_BYTES_PER_QUARTET = 3
const BASE64_CHARACTERS_PER_QUARTET = 4

export type ExportedPowerPoint = {
  bytes: Uint8Array
  fileName: string
  warnings: string[]
}

export interface ExportPowerPointUseCase {
  export(input: unknown): Promise<ExportedPowerPoint>
}

export class ExportPowerPointService implements ExportPowerPointUseCase {
  constructor(private readonly templates?: TemplateRepository) {}

  async export(input: unknown): Promise<ExportedPowerPoint> {
    assertBoundedJsonValue(input)
    const { presentation, issues } = normalizePresentationSpec(input)
    const errors = issues.filter((issue) => issue.level === 'error')

    if (!presentation || errors.length > 0) {
      throw new ApiError(
        422,
        'invalid_presentation_json',
        'The JSON could not be converted into a PowerPoint presentation.',
      )
    }

    const hydratedPresentation = this.templates
      ? hydrateTemplateAssetSources(presentation, this.templates)
      : presentation
    validateImageSources(hydratedPresentation)
    const bytes = await buildThemedPptxBytes(hydratedPresentation)

    return {
      bytes,
      fileName: buildSuggestedFileName(hydratedPresentation),
      warnings: issues
        .filter((issue) => issue.level === 'warning')
        .map((issue) => `${issue.path}: ${issue.message}`),
    }
  }
}

function assertBoundedJsonValue(input: unknown): asserts input is JsonValue {
  const pending: Array<{ depth: number; value: unknown }> = [{ depth: 0, value: input }]
  let nodeCount = 0

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) {
      continue
    }

    nodeCount += 1
    if (nodeCount > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) {
      throw new ApiError(
        422,
        'presentation_too_complex',
        'The presentation JSON exceeds the processing complexity limit.',
      )
    }

    const value = current.value
    if (
      value === null
      || typeof value === 'string'
      || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))
    ) {
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        pending.push({ depth: current.depth + 1, value: entry })
      }
      continue
    }

    if (isPlainRecord(value)) {
      for (const entry of Object.values(value)) {
        pending.push({ depth: current.depth + 1, value: entry })
      }
      continue
    }

    throw new ApiError(
      400,
      'invalid_json_value',
      'The request body contains an unsupported JSON value.',
    )
  }
}

function validateImageSources(presentation: NormalizedPresentation) {
  let embeddedBytes = 0

  for (const slide of presentation.slides) {
    for (const element of slide.elements) {
      if (element.kind !== 'image') {
        continue
      }

      const match = /^data:image\/(?:png|jpeg|jpg|gif|svg\+xml|emf);base64,([a-z0-9+/]*={0,2})$/iu.exec(
        element.src,
      )
      if (!match) {
        throw new ApiError(
          422,
          'unsupported_image_source',
          'Exported images must use an embedded base64 data URI.',
        )
      }

      const base64 = match[1] ?? ''
      embeddedBytes += Math.floor(
        (base64.length * BASE64_BYTES_PER_QUARTET) / BASE64_CHARACTERS_PER_QUARTET,
      )
      if (embeddedBytes > MAX_EMBEDDED_IMAGE_BYTES) {
        throw new ApiError(
          413,
          'embedded_images_too_large',
          'The embedded presentation images exceed the processing limit.',
        )
      }
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
