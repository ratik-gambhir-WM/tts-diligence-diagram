import type { NormalizedPresentation, PowerPointWriteOptions } from './PowerpointTypes'
import westMonroeLogoImage from '../../slide-assets/element-5.png'
import {
  applyDefaultThemeToPptx,
  downloadPptxBytes,
  insertPptxBytesIntoExistingDeck,
  writePptxBytesToFileHandle,
} from './PowerpointFile'
import { buildPptxPresentation } from './PowerpointRenderer'
import { slugify } from './PowerpointUtils'

export { normalizePresentationSpec } from './PowerpointNormalizer'
export { buildPptxPresentation } from './PowerpointRenderer'
export { getConnectorAwareElementOrder } from './PowerpointLayering'
export type {
  DashStyle,
  HorizontalAlign,
  LineOcclusionRect,
  NormalizationOptions,
  NormalizedElement,
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedShapeElement,
  NormalizedSlide,
  NormalizedTextElement,
  NormalizedTextRun,
  PowerPointFileHandle,
  PowerPointWriteOptions,
  ValidationIssue,
  VerticalAlign,
} from './PowerpointTypes'

export function buildSuggestedFileName(presentation: NormalizedPresentation) {
  const stem = slugify(presentation.meta.title || 'generated-presentation')
  return `${stem || 'generated-presentation'}.pptx`
}

export async function exportPresentationAsPptx(
  presentation: NormalizedPresentation,
  fileName: string,
) {
  const themed = await buildThemedPptxBytes(presentation)
  downloadPptxBytes(themed, fileName)
}

export async function writePptxPresentation(
  presentation: NormalizedPresentation,
  options: PowerPointWriteOptions,
) {
  const themed = await buildThemedPptxBytes(presentation, {
    compression: options.compression,
  })
  const targetFile = options.targetFile ?? (await options.targetFileHandle?.getFile())
  const output = targetFile
    ? await insertPptxBytesIntoExistingDeck(themed, targetFile, {
        compression: options.compression,
        insertAfterSlide: options.insertAfterSlide,
      })
    : {
        bytes: themed,
        fileName: options.fileName,
      }

  if (options.writeMode === 'overwrite') {
    if (!options.targetFileHandle) {
      throw new Error('Direct editing requires choosing the .pptx with browser write access.')
    }

    await writePptxBytesToFileHandle(output.bytes, options.targetFileHandle)
    return
  }

  downloadPptxBytes(output.bytes, output.fileName)
}

export async function buildThemedPptxBytes(
  presentation: NormalizedPresentation,
  options: Pick<PowerPointWriteOptions, 'compression'> = {},
) {
  const pptx = buildPptxPresentation(presentation, {
    brandingImageSource: westMonroeLogoImage,
  })
  const raw = await pptx.write({ outputType: 'uint8array', compression: options.compression ?? true })
  return applyDefaultThemeToPptx(raw, options)
}
