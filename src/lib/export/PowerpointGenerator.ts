import PptxGenJS from 'pptxgenjs'

type UnknownRecord = Record<string, unknown>

type VerticalAlign = 'top' | 'middle' | 'bottom'
type HorizontalAlign = 'left' | 'center' | 'right'
type DashStyle = 'solid' | 'dash' | 'dot'

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface NormalizedTextRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  fontFace: string
  fontSize: number
  breakLine?: boolean
}

interface BaseElement {
  id: string
  sourcePath: string
  opacity: number
  rotate: number
  valign: VerticalAlign
}

export interface NormalizedTextElement extends BaseElement {
  kind: 'text'
  x: number
  y: number
  w: number
  h: number
  text: string
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
  padding: number
  align: HorizontalAlign
  color: string
  fontSize: number
  fontFace: string
  bold: boolean
  italic: boolean
  runs: NormalizedTextRun[]
}

export interface NormalizedShapeElement extends BaseElement {
  kind: 'shape'
  x: number
  y: number
  w: number
  h: number
  shape: string
  label: string
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
  padding: number
  align: HorizontalAlign
  textColor: string
  fontSize: number
  fontFace: string
  bold: boolean
  textRuns: NormalizedTextRun[]
}

export interface NormalizedLineElement extends BaseElement {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
  dash: DashStyle
  endArrow: 'none' | 'triangle' | 'arrow' | 'diamond' | 'oval' | 'stealth'
}

export interface NormalizedImageElement extends BaseElement {
  kind: 'image'
  x: number
  y: number
  w: number
  h: number
  src: string
  fit: 'contain' | 'cover' | 'stretch'
  borderRadius: number
  altText: string
}

export type NormalizedElement =
  | NormalizedTextElement
  | NormalizedShapeElement
  | NormalizedLineElement
  | NormalizedImageElement

export interface NormalizedSlide {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  elements: NormalizedElement[]
}

export interface NormalizedPresentation {
  meta: {
    title: string
    width: number
    height: number
    sourceType: 'native-presentation'
  }
  slides: NormalizedSlide[]
}

export interface NormalizationOptions {
  baseDir?: string
}

export interface PowerPointWriteOptions {
  fileName: string
  compression?: boolean
}

const DEFAULT_WIDTH_PX = 1280
const DEFAULT_HEIGHT_PX = 720
const DEFAULT_FONT_FACE = 'Aptos'

const shapeAliases: Record<string, string> = {
  rect: 'rect',
  roundedRect: 'roundRect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  oval: 'ellipse',
  diamond: 'diamond',
  chevron: 'chevron',
  database: 'flowChartMagneticDisk',
  cylinder: 'flowChartMagneticDisk',
  flowChartMagneticDisk: 'flowChartMagneticDisk',
  line: 'line',
}

export function normalizePresentationSpec(
  input: unknown,
  options: NormalizationOptions = {},
): {
  presentation?: NormalizedPresentation
  issues: ValidationIssue[]
} {
  const issues: ValidationIssue[] = []

  if (Array.isArray(input)) {
    const slides = input
      .map((entry, index) => normalizeSingleSlideLike(entry, issues, `slides[${index}]`, options))
      .filter((slide): slide is NormalizedSlide => slide !== undefined)

    if (!slides.length) {
      issues.push({
        level: 'error',
        path: 'slides',
        message: 'No valid slides were found in the provided array.',
      })
      return { issues }
    }

    return {
      presentation: {
        meta: {
          title: 'Generated Presentation',
          width: slides[0].width,
          height: slides[0].height,
          sourceType: 'native-presentation',
        },
        slides,
      },
      issues,
    }
  }

  if (!isRecord(input)) {
    issues.push({
      level: 'error',
      path: 'root',
      message: 'Expected a JSON object or array of slide objects.',
    })
    return { issues }
  }

  const presentation = normalizeNativePresentation(input, issues, options)
  return { presentation, issues }
}

export function buildSuggestedFileName(presentation: NormalizedPresentation) {
  const stem = slugify(presentation.meta.title || 'generated-presentation')
  return `${stem || 'generated-presentation'}.pptx`
}

export async function exportPresentationAsPptx(
  presentation: NormalizedPresentation,
  fileName: string,
) {
  await writePptxPresentation(presentation, { fileName })
}

export async function writePptxPresentation(
  presentation: NormalizedPresentation,
  options: PowerPointWriteOptions,
) {
  const pptx = buildPptxPresentation(presentation)
  await pptx.writeFile({
    fileName: options.fileName,
    compression: options.compression ?? true,
  })
}

export function buildPptxPresentation(presentation: NormalizedPresentation) {
  const pptx = new PptxGenJS()
  const widthInches = pxToInches(presentation.meta.width)
  const heightInches = pxToInches(presentation.meta.height)

  pptx.defineLayout({
    name: 'JSON_LAYOUT',
    width: widthInches,
    height: heightInches,
  })
  pptx.layout = 'JSON_LAYOUT'
  pptx.author = 'OpenAI Codex'
  pptx.company = 'OpenAI'
  pptx.subject = 'JSON to PowerPoint'
  pptx.title = presentation.meta.title

  for (const slideSpec of presentation.slides) {
    const slide = pptx.addSlide()
    slide.background = { color: cleanHex(slideSpec.backgroundColor, 'FFFFFF') }

    for (const element of slideSpec.elements) {
      if (element.kind === 'line') {
        slide.addShape('line', {
          x: pxToInches(element.x1),
          y: pxToInches(element.y1),
          w: pxToInches(element.x2 - element.x1),
          h: pxToInches(element.y2 - element.y1),
          rotate: element.rotate,
          line: {
            color: cleanHex(element.stroke, '000000'),
            width: element.strokeWidth,
            transparency: opacityToTransparency(element.opacity),
            dashType:
              element.dash === 'solid' ? 'solid' : element.dash === 'dot' ? 'sysDot' : 'dash',
            endArrowType: element.endArrow,
          },
        })
        continue
      }

      if (element.kind === 'image') {
        const imageOptions = buildImageOptions(element)
        slide.addImage(imageOptions)
        continue
      }

      if (element.kind === 'text') {
        slide.addText(toPptxTextRuns(element.runs), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.color, '111827'),
          bold: element.bold,
          italic: element.italic,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          fill: colorToFill(element.fill, element.opacity),
          line: colorToLine(element.stroke, element.strokeWidth, element.opacity),
          rotate: element.rotate,
          fit: 'shrink',
          isTextBox: true,
          shape: element.borderRadius > 0 ? 'roundRect' : 'rect',
        })
        continue
      }

      slide.addShape(toPptxShapeName(element.shape), {
        x: pxToInches(element.x),
        y: pxToInches(element.y),
        w: pxToInches(element.w),
        h: pxToInches(element.h),
        rotate: element.rotate,
        fill: colorToFill(element.fill, element.opacity),
        line: colorToLine(element.stroke, element.strokeWidth, element.opacity),
      })

      if (element.label.trim()) {
        slide.addText(toPptxTextRuns(element.textRuns, { stackVertically: element.shape === 'rect' }), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.textColor, '111827'),
          bold: element.bold,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          rotate: element.rotate,
          fit: 'shrink',
          isTextBox: true,
          fill: { color: 'FFFFFF', transparency: 100 },
          line: { color: 'FFFFFF', transparency: 100, width: 0 },
          shape: 'rect',
        })
      }
    }
  }

  return pptx
}

function normalizeNativePresentation(
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
        'Expected a slide/deck object with `slides` or `elements`.',
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

function normalizeSingleSlideLike(
  input: unknown,
  issues: ValidationIssue[],
  pathLabel: string,
  options: NormalizationOptions,
): NormalizedSlide | undefined {
  if (!isRecord(input)) {
    issues.push({
      level: 'warning',
      path: pathLabel,
      message: 'Skipped a non-object slide entry.',
    })
    return undefined
  }

  return normalizeNativeSlide(input, 0, DEFAULT_WIDTH_PX, DEFAULT_HEIGHT_PX, issues, options)
}

function normalizeNativeSlide(
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
  const elements = mappedElements.filter(isDefined)

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
      x1,
      y1,
      x2,
      y2,
      stroke: cleanHex(asString(input.stroke) || asString(input.color), '334155'),
      strokeWidth: coerceNumber(input.strokeWidth, 1.5),
      dash: normalizeDash(asString(input.dash)),
      endArrow: normalizeArrow(asString(input.endArrow) || asString(input.arrow)),
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

function buildImageOptions(element: NormalizedImageElement) {
  const base = {
    x: pxToInches(element.x),
    y: pxToInches(element.y),
    w: pxToInches(element.w),
    h: pxToInches(element.h),
    altText: element.altText,
    transparency: opacityToTransparency(element.opacity),
    rotate: element.rotate,
  }

  if (element.src.startsWith('data:')) {
    return {
      ...base,
      data: element.src,
    }
  }

  return {
    ...base,
    path: element.src,
  }
}

function toPptxTextRuns(
  runs: NormalizedTextRun[],
  options: { stackVertically?: boolean } = {},
) {
  return runs.map((run, index) => ({
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline ? {} : undefined,
      breakLine: options.stackVertically ? index < runs.length - 1 : run.breakLine,
      color: cleanHex(run.color, '111827'),
      fontFace: run.fontFace,
      fontSize: run.fontSize,
    },
  }))
}

function colorToFill(color: string, opacity = 1) {
  if (color === 'transparent') {
    return { color: 'FFFFFF', transparency: 100 }
  }

  return { color: cleanHex(color, 'FFFFFF'), transparency: opacityToTransparency(opacity) }
}

function colorToLine(color: string, width: number, opacity = 1) {
  if (color === 'transparent' || width <= 0) {
    return { color: 'FFFFFF', transparency: 100, width: 0 }
  }

  return { color: cleanHex(color, '000000'), transparency: opacityToTransparency(opacity), width }
}

function normalizeShapeName(shape: string | undefined) {
  if (!shape) {
    return 'rect'
  }

  return shapeAliases[shape] || shape
}

function toPptxShapeName(shape: string) {
  return normalizeShapeName(shape) as never
}

function normalizeNativeKind(kind: string | undefined) {
  if (!kind) {
    return undefined
  }

  const lower = kind.toLowerCase()
  if (lower === 'text' || lower === 'textbox') {
    return 'text'
  }
  if (
    lower === 'image' ||
    lower === 'picture'
  ) {
    return 'image'
  }
  if (
    lower === 'line' ||
    lower === 'arrow' ||
    lower === 'connector'
  ) {
    return 'line'
  }
  return 'shape'
}

function normalizeAlign(value: string | undefined): HorizontalAlign {
  if (value === 'ctr' || value === 'center') {
    return 'center'
  }

  if (value === 'r' || value === 'right') {
    return 'right'
  }

  return 'left'
}

function normalizeValign(value: string | undefined): VerticalAlign {
  if (value === 'top' || value === 't') {
    return 'top'
  }

  if (value === 'bottom' || value === 'b') {
    return 'bottom'
  }

  return 'middle'
}

function toPptxVerticalAlign(value: VerticalAlign) {
  if (value === 'top') {
    return 'top'
  }

  if (value === 'bottom') {
    return 'bottom'
  }

  return 'middle'
}

function normalizeDash(value: string | undefined): DashStyle {
  if (value === 'dash' || value === 'sysDash') {
    return 'dash'
  }

  if (value === 'dot' || value === 'sysDot') {
    return 'dot'
  }

  return 'solid'
}

function normalizeArrow(value: string | undefined): NormalizedLineElement['endArrow'] {
  if (
    value === 'triangle' ||
    value === 'arrow' ||
    value === 'diamond' ||
    value === 'oval' ||
    value === 'stealth'
  ) {
    return value
  }

  return 'none'
}

function resolveImageSource(src: string | undefined, options: NormalizationOptions) {
  if (!src) {
    return undefined
  }

  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }

  if (isAbsolutePathLike(src)) {
    return src
  }

  if (options.baseDir) {
    return joinPathLike(options.baseDir, src)
  }

  return src
}

function normalizeImageFit(value: string | undefined): NormalizedImageElement['fit'] {
  if (value === 'cover' || value === 'stretch') {
    return value
  }

  return 'contain'
}

function opacityToTransparency(opacity: number) {
  return Math.round((1 - clamp01(opacity)) * 100)
}

function pxToInches(px: number) {
  return px / 96
}

function inchesToPx(inches: number) {
  return inches * 96
}

function cleanHex(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback
  }

  const trimmed = value.replace('#', '').trim()
  if (trimmed.toLowerCase() === 'transparent') {
    return 'transparent'
  }

  return /^[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function coerceNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function coerceBoolean(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}


function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function isAbsolutePathLike(value: string) {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

function joinPathLike(baseDir: string, relativePath: string) {
  const separator = baseDir.includes('\\') ? '\\' : '/'
  const trimmedBase = baseDir.replace(/[\\/]+$/, '')
  const trimmedRelative = relativePath.replace(/^[\\/]+/, '')
  return `${trimmedBase}${separator}${trimmedRelative}`
}
