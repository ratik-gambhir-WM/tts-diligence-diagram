import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  NormalizedElement,
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedShapeElement,
  NormalizedTextElement,
  NormalizedTextRun,
} from '../shared/PowerpointTypes'
import type {
  PowerPointCanvasElement,
  PowerPointCanvasImageElement,
  PowerPointCanvasLineElement,
  PowerPointCanvasShapeElement,
  PowerPointCanvasTextElement,
  PowerPointCanvasTextRun,
} from './PowerpointImportTypes'
import { optionalNumber, prune, round } from './PowerpointImportUtils'
import { DEFAULT_OPACITY, DEFAULT_TEXT_PADDING_PT } from '../shared/PowerpointConstants'

export async function compactPresentation(
  presentation: NormalizedPresentation,
  outputPath: string,
  options: { embedAssets?: boolean } = {},
) {
  return {
    presentation: {
      title: presentation.meta.title,
      preserveElementOrder: presentation.meta.preserveElementOrder,
      showBranding: presentation.meta.showBranding,
      slides: await Promise.all(
        presentation.slides.map(async (slide) => ({
          id: slide.id,
          name: slide.name,
          width: round(slide.width),
          height: round(slide.height),
          backgroundColor: slide.backgroundColor,
          elements: await Promise.all(
            slide.elements.map((element) => compactElement(element, outputPath, options)),
          ),
        })),
      ),
    },
  }
}

async function compactElement(
  element: NormalizedElement,
  outputPath: string,
  options: { embedAssets?: boolean },
): Promise<PowerPointCanvasElement> {
  if (element.kind === 'line') {
    return compactLine(element)
  }

  if (element.kind === 'image') {
    return compactImage(element, outputPath, options)
  }

  if (element.kind === 'text') {
    return compactText(element)
  }

  return compactShape(element)
}

function compactShape(element: NormalizedShapeElement): PowerPointCanvasShapeElement {
  const hasText = !!element.label
  return prune({
    id: element.id,
    type: 'shape' as const,
    shape: element.shape,
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || undefined,
    flipV: element.flipV || undefined,
    opacity: optionalNumber(element.opacity, DEFAULT_OPACITY),
    fill: element.fill,
    fillOpacity: optionalNumber(element.fillOpacity ?? DEFAULT_OPACITY, DEFAULT_OPACITY),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? DEFAULT_OPACITY, DEFAULT_OPACITY),
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: hasText ? optionalNumber(round(element.padding), DEFAULT_TEXT_PADDING_PT) : undefined,
    text: element.label || undefined,
    align: hasText && element.align !== 'left' ? element.align : undefined,
    valign: hasText && element.valign !== 'middle' ? element.valign : undefined,
    fontSize: hasText ? round(element.fontSize) : undefined,
    fontFace: hasText ? element.fontFace : undefined,
    bold: hasText && element.bold ? true : undefined,
    textColor: hasText ? element.textColor : undefined,
    runs: compactRuns(element.textRuns),
  })
}

function compactText(element: NormalizedTextElement): PowerPointCanvasTextElement {
  return prune({
    id: element.id,
    type: 'text' as const,
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || undefined,
    flipV: element.flipV || undefined,
    opacity: optionalNumber(element.opacity, DEFAULT_OPACITY),
    fill: element.fill,
    fillOpacity: optionalNumber(element.fillOpacity ?? DEFAULT_OPACITY, DEFAULT_OPACITY),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? DEFAULT_OPACITY, DEFAULT_OPACITY),
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: optionalNumber(round(element.padding), DEFAULT_TEXT_PADDING_PT),
    text: element.text || undefined,
    align: element.align === 'left' ? undefined : element.align,
    valign: element.valign === 'middle' ? undefined : element.valign,
    fontSize: round(element.fontSize),
    fontFace: element.fontFace,
    bold: element.bold || undefined,
    italic: element.italic || undefined,
    textColor: element.color,
    runs: compactRuns(element.runs),
  })
}

function compactLine(element: NormalizedLineElement): PowerPointCanvasLineElement {
  return prune({
    id: element.id,
    type: 'line' as const,
    x1: round(element.x1),
    y1: round(element.y1),
    x2: round(element.x2),
    y2: round(element.y2),
    rotate: optionalNumber(element.rotate, 0),
    beginArrow: !element.beginArrow || element.beginArrow === 'none' ? undefined : element.beginArrow,
    opacity: optionalNumber(element.opacity, DEFAULT_OPACITY),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? DEFAULT_OPACITY, DEFAULT_OPACITY),
    strokeWidth: round(element.strokeWidth),
    dash: element.dash === 'solid' ? undefined : element.dash,
    endArrow: element.endArrow === 'none' ? undefined : element.endArrow,
  })
}

async function compactImage(
  element: NormalizedImageElement,
  outputPath: string,
  options: { embedAssets?: boolean },
): Promise<PowerPointCanvasImageElement> {
  return prune({
    id: element.id,
    type: 'image' as const,
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || undefined,
    flipV: element.flipV || undefined,
    opacity: optionalNumber(element.opacity, DEFAULT_OPACITY),
    src: options.embedAssets ? element.src : await externalizeImage(element.src, outputPath),
    fit: element.fit,
    crop: element.crop
      ? prune({
          top: optionalNumber(round(element.crop.top), 0),
          right: optionalNumber(round(element.crop.right), 0),
          bottom: optionalNumber(round(element.crop.bottom), 0),
          left: optionalNumber(round(element.crop.left), 0),
        })
      : undefined,
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    altText: element.altText || undefined,
  })
}

function compactRuns(runs: NormalizedTextRun[]): PowerPointCanvasTextRun[] | undefined {
  if (!runs.length) {
    return undefined
  }

  return runs.map((run) =>
    prune({
      text: run.text,
      bold: run.bold || undefined,
      italic: run.italic || undefined,
      underline: run.underline || undefined,
      color: run.color,
      fontFace: run.fontFace,
      fontSize: round(run.fontSize),
      breakLine: run.breakLine || undefined,
    }),
  )
}

async function externalizeImage(src: string, outputPath: string) {
  const dataUri = /^data:([^;,]+);base64,(.+)$/u.exec(src)
  if (!dataUri) {
    return src
  }

  const [, mimeType, base64] = dataUri
  const extension = mimeTypeToExtension(mimeType)
  const digest = createHash('sha256').update(base64).digest('hex').slice(0, 12)
  const fileName = `image-${digest}${extension}`
  const assetDir = path.join(path.dirname(outputPath), 'assets')
  const assetPath = path.join(assetDir, fileName)
  await mkdir(assetDir, { recursive: true })
  await writeFile(assetPath, Buffer.from(base64, 'base64'))
  return `./assets/${fileName}`
}

function mimeTypeToExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return '.jpg'
  }
  if (mimeType === 'image/svg+xml') {
    return '.svg'
  }
  if (mimeType === 'image/gif') {
    return '.gif'
  }
  if (mimeType === 'image/emf') {
    return '.emf'
  }
  return '.png'
}
