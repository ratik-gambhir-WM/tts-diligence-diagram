import { DEFAULT_FONT_FACE, DEFAULT_HEIGHT_PX, DEFAULT_WIDTH_PX } from './PowerpointConstants'
import type {
  NormalizationOptions,
  NormalizedElement,
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedShapeElement,
  NormalizedSlide,
  NormalizedTextElement,
  UnknownRecord,
  ValidationIssue,
} from './PowerpointTypes'
import { addConnectorOcclusionRects } from './PowerpointLayering'
import {
  asString,
  cleanHex,
  clamp01,
  coerceBoolean,
  coerceNumber,
  inchesToPx,
  isDefined,
  isRecord,
  normalizeAlign,
  normalizeArrow,
  normalizeDash,
  normalizeImageFit,
  normalizeLineType,
  normalizeNativeKind,
  normalizeShapeName,
  normalizeValign,
  resolveImageSource,
} from './PowerpointUtils'

export function normalizeNativePresentation(
  input: UnknownRecord,
  issues: ValidationIssue[],
  options: NormalizationOptions,
): NormalizedPresentation | undefined {
  const presentationNode = isRecord(input.presentation) ? input.presentation : input
  const slidesSource = Array.isArray(presentationNode.slides)
    ? presentationNode.slides
    : Array.isArray((presentationNode.slide as UnknownRecord | undefined)?.elements)
      ? [presentationNode.slide]
      : Array.isArray(input.slides)
        ? input.slides
        : Array.isArray(input.elements)
          ? [input]
          : undefined

  if (!slidesSource?.length) {
    issues.push({
      level: 'error',
      path: 'slides',
      message:
        'Expected either an extracted PowerPoint slide payload (`shapeTree`) or a slide/deck object with `slides` or `elements`.',
    })
    return undefined
  }

  const width = resolveNativeDimension(
    presentationNode.canvas,
    presentationNode.size,
    presentationNode.layout,
    'width',
    DEFAULT_WIDTH_PX,
  )
  const height = resolveNativeDimension(
    presentationNode.canvas,
    presentationNode.size,
    presentationNode.layout,
    'height',
    DEFAULT_HEIGHT_PX,
  )

  const mappedSlides: Array<NormalizedSlide | undefined> = slidesSource
    .map((slideSource, index) =>
      normalizeNativeSlide(slideSource, index, width, height, issues, options),
    )
  const slides = mappedSlides.filter(isDefined)

  if (!slides.length) {
    issues.push({
      level: 'error',
      path: 'slides',
      message: 'The deck did not contain any valid slides after normalization.',
    })
    return undefined
  }

  return {
    meta: {
      title: asString(presentationNode.title) || 'Generated Presentation',
      width,
      height,
      sourceType: 'native-presentation',
    },
    slides,
  }
}

export function normalizeNativeSlide(
  slideSource: unknown,
  index: number,
  defaultWidth: number,
  defaultHeight: number,
  issues: ValidationIssue[],
  options: NormalizationOptions,
): NormalizedSlide | undefined {
  if (!isRecord(slideSource)) {
    issues.push({
      level: 'warning',
      path: `slides[${index}]`,
      message: 'Skipped a slide because it was not an object.',
    })
    return undefined
  }

  const width = resolveNativeDimension(
    slideSource.canvas,
    slideSource.size,
    slideSource.layout,
    'width',
    defaultWidth,
  )
  const height = resolveNativeDimension(
    slideSource.canvas,
    slideSource.size,
    slideSource.layout,
    'height',
    defaultHeight,
  )
  const elementsSource = Array.isArray(slideSource.elements) ? slideSource.elements : []
  const mappedElements: Array<NormalizedElement | undefined> = elementsSource
    .map((item, elementIndex) =>
      normalizeNativeElement(item, width, height, issues, `slides[${index}].elements[${elementIndex}]`, options),
    )
  const elements = addConnectorOcclusionRects(mappedElements.filter(isDefined), { height, width })

  return {
    id: asString(slideSource.id) || `slide-${index + 1}`,
    name: asString(slideSource.name) || asString(slideSource.title) || `Slide ${index + 1}`,
    width,
    height,
    backgroundColor: cleanHex(asString(slideSource.backgroundColor), 'FFFFFF'),
    elements,
  }
}

function normalizeNativeElement(
  input: unknown,
  width: number,
  height: number,
  issues: ValidationIssue[],
  pathLabel: string,
  options: NormalizationOptions,
): NormalizedElement | undefined {
  if (!isRecord(input)) {
    issues.push({
      level: 'warning',
      path: pathLabel,
      message: 'Skipped a non-object element.',
    })
    return undefined
  }

  const rawKind =
    asString(input.kind) || asString(input.type) || asString(input.elementType) || asString(input.shape)
  const kind = normalizeNativeKind(rawKind)

  if (!kind) {
    issues.push({
      level: 'warning',
      path: pathLabel,
      message: `Unsupported element type "${rawKind ?? 'unknown'}".`,
    })
    return undefined
  }

  if (kind === 'line') {
    const x1 = resolvePosition(input.x1 ?? input.x ?? input.left, width)
    const y1 = resolvePosition(input.y1 ?? input.y ?? input.top, height)
    const x2 =
      input.x2 !== undefined
        ? resolvePosition(input.x2, width)
        : x1 + resolvePosition(input.w ?? input.width ?? 0, width)
    const y2 =
      input.y2 !== undefined
        ? resolvePosition(input.y2, height)
        : y1 + resolvePosition(input.h ?? input.height ?? 0, height)

    const element: NormalizedLineElement = {
      kind: 'line',
      id: asString(input.id) || pathLabel,
      sourcePath: pathLabel,
      opacity: clamp01(coerceNumber(input.opacity, 1)),
      rotate: coerceNumber(input.rotate, 0),
      valign: 'middle',
      lineType: normalizeLineType(asString(input.lineType)),
      x1,
      y1,
      x2,
      y2,
      stroke: cleanHex(asString(input.stroke) || asString(input.color), '334155'),
      strokeWidth: coerceNumber(input.strokeWidth, 1.5),
      dash: normalizeDash(asString(input.dash)),
      endArrow: normalizeArrow(asString(input.endArrow) || asString(input.arrow)),
      occlusionRects: [],
    }
    return element
  }

  if (kind === 'image') {
    const src = resolveImageSource(asString(input.src) || asString(input.path) || asString(input.data), options)
    if (!src) {
      issues.push({
        level: 'warning',
        path: `${pathLabel}.src`,
        message: 'Skipped an image element because it did not include a usable image source.',
      })
      return undefined
    }

    const element: NormalizedImageElement = {
      kind: 'image',
      id: asString(input.id) || pathLabel,
      sourcePath: pathLabel,
      opacity: clamp01(coerceNumber(input.opacity, 1)),
      rotate: coerceNumber(input.rotate, 0),
      valign: 'middle',
      x: resolvePosition(input.x ?? input.left, width),
      y: resolvePosition(input.y ?? input.top, height),
      w: resolvePosition(input.w ?? input.width, width),
      h: resolvePosition(input.h ?? input.height, height),
      src,
      fit: normalizeImageFit(asString(input.fit)),
      borderRadius: coerceNumber(input.borderRadius, 0),
      altText: asString(input.altText) || '',
    }
    return element
  }

  const x = resolvePosition(input.x ?? input.left, width)
  const y = resolvePosition(input.y ?? input.top, height)
  const w = resolvePosition(input.w ?? input.width, width)
  const h = resolvePosition(input.h ?? input.height, height)
  const padding = coerceNumber(input.padding, 8)
  const align = normalizeAlign(asString(input.align))
  const valign = normalizeValign(asString(input.valign))
  const fontSize = coerceNumber(input.fontSize, 18)
  const fontFace = asString(input.fontFace) || DEFAULT_FONT_FACE
  const textColor = cleanHex(asString(input.color) || asString(input.textColor), '111827')
  const textContent = asString(input.text) || asString(input.label) || ''
  const nativeRuns = normalizeNativeTextRuns(input.runs, fontFace, fontSize, textColor)
  const runs =
    nativeRuns.length > 0
      ? nativeRuns
      : textContent
        ? [
            {
              text: textContent,
              bold: coerceBoolean(input.bold),
              italic: coerceBoolean(input.italic),
              underline: false,
              fontFace,
              fontSize,
              color: textColor,
            },
          ]
        : []

  if (kind === 'text') {
    const element: NormalizedTextElement = {
      kind: 'text',
      id: asString(input.id) || pathLabel,
      sourcePath: pathLabel,
      opacity: clamp01(coerceNumber(input.opacity, 1)),
      rotate: coerceNumber(input.rotate, 0),
      valign,
      x,
      y,
      w,
      h,
      text: textContent,
      fill: cleanHex(asString(input.fill), 'FFFFFF'),
      stroke: cleanHex(asString(input.stroke), 'FFFFFF'),
      strokeWidth: coerceNumber(input.strokeWidth, 0),
      borderRadius: coerceNumber(input.borderRadius, 0),
      padding,
      align,
      color: textColor,
      fontSize,
      fontFace,
      bold: coerceBoolean(input.bold),
      italic: coerceBoolean(input.italic),
      runs,
    }
    return element
  }

  const element: NormalizedShapeElement = {
    kind: 'shape',
    id: asString(input.id) || pathLabel,
    sourcePath: pathLabel,
    opacity: clamp01(coerceNumber(input.opacity, 1)),
    rotate: coerceNumber(input.rotate, 0),
    valign,
    x,
    y,
    w,
    h,
    shape: normalizeShapeName(asString(input.shape) || rawKind),
    label: textContent,
    fill: cleanHex(asString(input.fill), 'E5EEF8'),
    stroke: cleanHex(asString(input.stroke), '334155'),
    strokeWidth: coerceNumber(input.strokeWidth, 1),
    borderRadius: coerceNumber(input.borderRadius, 0),
    padding,
    align,
    textColor,
    fontSize,
    fontFace,
    bold: coerceBoolean(input.bold),
    textRuns: runs,
  }
  return element
}

function normalizeNativeTextRuns(
  input: unknown,
  fallbackFontFace: string,
  fallbackFontSize: number,
  fallbackColor: string,
) {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .filter((run): run is UnknownRecord => isRecord(run))
    .map((run) => ({
      text: asString(run.text) || '',
      bold: coerceBoolean(run.bold),
      italic: coerceBoolean(run.italic),
      underline: coerceBoolean(run.underline),
      color: cleanHex(asString(run.color), fallbackColor),
      fontFace: asString(run.fontFace) || fallbackFontFace,
      fontSize: coerceNumber(run.fontSize, fallbackFontSize),
      breakLine: coerceBoolean(run.breakLine) || undefined,
    }))
}

function resolveNativeDimension(
  canvas: unknown,
  size: unknown,
  layout: unknown,
  axis: 'width' | 'height',
  fallback: number,
) {
  const canvasNode = isRecord(canvas) ? canvas : undefined
  const sizeNode = isRecord(size) ? size : undefined
  const layoutNode = isRecord(layout) ? layout : undefined
  const key = axis === 'width' ? 'width' : 'height'
  const inchesKey = axis === 'width' ? 'widthInches' : 'heightInches'

  const value =
    canvasNode?.[key] ??
    sizeNode?.[key] ??
    layoutNode?.[key] ??
    layoutNode?.[axis === 'width' ? 'w' : 'h'] ??
    layoutNode?.[inchesKey]

  if (typeof value === 'number') {
    if (String(inchesKey) in (layoutNode ?? {})) {
      return inchesToPx(value)
    }
    return value
  }

  return fallback
}

function resolvePosition(value: unknown, canvasSize: number) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.endsWith('%')) {
      const percent = Number(trimmed.slice(0, -1))
      return Number.isFinite(percent) ? (canvasSize * percent) / 100 : 0
    }
    if (trimmed.endsWith('in')) {
      const inches = Number(trimmed.slice(0, -2))
      return Number.isFinite(inches) ? inchesToPx(inches) : 0
    }
    const numeric = Number(trimmed)
    return Number.isFinite(numeric) ? numeric : 0
  }

  return 0
}
