import type {
  NormalizedElement,
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedTextRun,
  ValidationIssue,
} from './pptx.ts'

type UnknownRecord = Record<string, unknown>
type VerticalAlign = 'top' | 'middle' | 'bottom'
type HorizontalAlign = 'left' | 'center' | 'right'
type DashStyle = 'solid' | 'dash' | 'dot'

interface XmlNode {
  tag: string
  attributes?: Record<string, string>
  children?: XmlNode[]
  text?: string
}

interface ExtractedRelationship {
  Id: string
  Type?: string
  Target?: string
  resolvedTarget?: string
  typeShort?: string
}

interface ExtractedSupportPart {
  path?: string
  size?: number
  relationshipType?: string
  contentTypeHint?: string
  base64?: string
  rawXml?: string
}

interface ExtractedTransform {
  xPx?: number
  yPx?: number
  widthPx?: number
  heightPx?: number
  rotation?: number | null
  xInches?: number
  yInches?: number
  widthInches?: number
  heightInches?: number
}

interface ExtractedTextRun {
  text?: string
  properties?: Record<string, string>
}

interface ExtractedTextParagraph {
  runs?: ExtractedTextRun[]
  properties?: Record<string, string>
  endParagraphRunProperties?: Record<string, string>
}

interface ExtractedTextBody {
  plainText?: string
  paragraphs?: ExtractedTextParagraph[]
  bodyProperties?: Record<string, string>
}

interface ExtractedShapeElement {
  path?: string
  zIndex?: number
  tag?: string
  kind?: string
  nonVisual?: {
    id?: number
    name?: string
    hidden?: boolean
  }
  transform?: ExtractedTransform
  presetGeometry?: {
    preset?: string
    xmlAst?: XmlNode
  }
  relationshipIds?: string[]
  xmlAst?: XmlNode
  text?: ExtractedTextBody
  shapeProperties?: XmlNode
  style?: XmlNode
}

export interface ExtractedSlideSpec {
  slideNumber?: number
  slideSize?: {
    widthPx?: number
    heightPx?: number
    widthInches?: number
    heightInches?: number
  }
  relationships?: ExtractedRelationship[]
  shapeTree?: {
    elements?: ExtractedShapeElement[]
  }
  summary?: {
    totalDrawableElements?: number
    textElementCount?: number
  }
  supportParts?: Record<string, ExtractedSupportPart>
}

const DEFAULT_WIDTH_PX = 1280
const DEFAULT_HEIGHT_PX = 720
const DEFAULT_FONT_FACE = 'Aptos'
const DEFAULT_THEME: Record<string, string> = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '44546A',
  lt2: 'E7E6E6',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
  hlink: '0563C1',
  folHlink: '954F72',
}

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

export function isExtractedSlideSpec(input: unknown): input is ExtractedSlideSpec {
  return isRecord(input) && 'shapeTree' in input
}

export function normalizeExtractedPresentation(
  input: ExtractedSlideSpec,
  issues: ValidationIssue[],
): NormalizedPresentation {
  const width = coerceNumber(input.slideSize?.widthPx, DEFAULT_WIDTH_PX)
  const height = coerceNumber(input.slideSize?.heightPx, DEFAULT_HEIGHT_PX)
  const theme = extractThemeColors(input.supportParts)
  const slideId = `slide-${input.slideNumber ?? 1}`
  const slideName = deriveTitleFromExtractedSlide(input)
  const elements = (input.shapeTree?.elements ?? [])
    .slice()
    .sort((left, right) => coerceNumber(left.zIndex, 0) - coerceNumber(right.zIndex, 0))
    .flatMap((element, index) =>
      normalizeExtractedElement(
        element,
        index,
        width,
        height,
        theme,
        input.relationships ?? [],
        input.supportParts ?? {},
        issues,
      ),
    )

  if (!elements.length) {
    issues.push({
      level: 'warning',
      path: 'shapeTree.elements',
      message: 'No exportable slide elements were found. The PowerPoint will be empty.',
    })
  }

  return {
    meta: {
      title: slideName,
      width,
      height,
      sourceType: 'extracted-slide',
    },
    slides: [
      {
        id: slideId,
        name: slideName,
        width,
        height,
        backgroundColor: 'FFFFFF',
        elements,
      },
    ],
  }
}

function normalizeExtractedElement(
  element: ExtractedShapeElement,
  index: number,
  slideWidth: number,
  slideHeight: number,
  theme: Record<string, string>,
  relationships: ExtractedRelationship[],
  supportParts: Record<string, ExtractedSupportPart>,
  issues: ValidationIssue[],
): NormalizedElement[] {
  if (element.nonVisual?.hidden) {
    return []
  }

  const id = `element-${element.nonVisual?.id ?? index + 1}`
  const sourcePath = element.path || `shapeTree.elements[${index}]`
  const transform = element.transform ?? {}
  const x = coerceNumber(transform.xPx, transform.xInches ? transform.xInches * 96 : 0)
  const y = coerceNumber(transform.yPx, transform.yInches ? transform.yInches * 96 : 0)
  const w = coerceNumber(transform.widthPx, transform.widthInches ? transform.widthInches * 96 : 0)
  const h = coerceNumber(transform.heightPx, transform.heightInches ? transform.heightInches * 96 : 0)
  const rotate = coerceNumber(transform.rotation, 0)

  if (element.kind === 'connector') {
    const lineNode = findChild(element.shapeProperties, 'a:ln')
    return [
      {
        kind: 'line',
        id,
        sourcePath,
        opacity: 1,
        rotate,
        valign: 'middle',
        x1: clampNumber(x, 0, slideWidth),
        y1: clampNumber(y, 0, slideHeight),
        x2: clampNumber(x + w, 0, slideWidth),
        y2: clampNumber(y + h, 0, slideHeight),
        stroke: parseLineColor(lineNode, theme, '334155'),
        strokeWidth: emuLineWidthToPoints(lineNode?.attributes?.w),
        dash: parseDashStyle(lineNode),
        endArrow: parseArrowType(lineNode),
      },
    ]
  }

  if (element.kind === 'graphicFrame') {
    const image = extractGraphicFrameImage(element, relationships, supportParts, id, sourcePath, x, y, w, h)
    if (image) {
      return [image]
    }

    issues.push({
      level: 'warning',
      path: sourcePath,
      message: 'Skipped a graphic frame because it is not a plain PowerPoint drawable element.',
    })
    return []
  }

  if (element.kind !== 'shape') {
    issues.push({
      level: 'warning',
      path: sourcePath,
      message: `Skipped unsupported extracted element kind "${element.kind ?? 'unknown'}".`,
    })
    return []
  }

  const textBody = element.text
  const textRuns = normalizeExtractedTextRuns(textBody, theme, element.style)
  const label = paragraphText(textBody)
  const fillNode = findChild(element.shapeProperties, 'a:solidFill')
  const lineNode = findChild(element.shapeProperties, 'a:ln')
  const hasNoFill = hasChild(element.shapeProperties, 'a:noFill') || hasChild(lineNode, 'a:noFill')
  const fill = hasNoFill ? 'transparent' : parseColor(fillNode, theme, 'transparent')
  const strokeVisible = !hasChild(lineNode, 'a:noFill')
  const stroke = strokeVisible ? parseLineColor(lineNode, theme, '334155') : 'transparent'
  const strokeWidth = strokeVisible ? emuLineWidthToPoints(lineNode?.attributes?.w) : 0
  const textColor =
    textRuns.find((run) => run.color)?.color ??
    parseFontColor(element.style, theme, stroke === 'transparent' ? '111827' : 'FFFFFF')
  const fontSize = textRuns.find((run) => run.fontSize)?.fontSize ?? 16
  const fontFace = textRuns.find((run) => run.fontFace)?.fontFace ?? DEFAULT_FONT_FACE
  const align = normalizeAlign(textBody?.paragraphs?.[0]?.properties?.algn)
  const valign = normalizeBodyAnchor(textBody?.bodyProperties?.anchor)
  const padding = bodyPadding(textBody?.bodyProperties)
  const shapeName = normalizeShapeName(element.presetGeometry?.preset)

  if (!label && w <= 0 && h <= 0) {
    return []
  }

  const textOnly =
    !!label &&
    (element.nonVisual?.name?.toLowerCase().includes('textbox') ||
      (fill === 'transparent' && stroke === 'transparent'))

  if (textOnly) {
    return [
      {
        kind: 'text',
        id,
        sourcePath,
        opacity: 1,
        rotate,
        valign,
        x,
        y,
        w: Math.max(w, 1),
        h: Math.max(h, fontSize * Math.max(textRuns.length, 1)),
        text: label,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 0,
        padding,
        align,
        color: textColor,
        fontSize,
        fontFace,
        bold: textRuns.some((run) => run.bold),
        italic: textRuns.some((run) => run.italic),
        runs: textRuns.length
          ? textRuns
          : [
              {
                text: label,
                bold: false,
                italic: false,
                underline: false,
                color: textColor,
                fontSize,
                fontFace,
              },
            ],
      },
    ]
  }

  return [
    {
      kind: 'shape',
      id,
      sourcePath,
      opacity: 1,
      rotate,
      valign,
      x,
      y,
      w,
      h,
      shape: shapeName,
      label,
      fill,
      stroke,
      strokeWidth,
      borderRadius: shapeName === 'roundRect' ? 18 : 0,
      padding,
      align,
      textColor,
      fontSize,
      fontFace,
      bold: textRuns.some((run) => run.bold),
      textRuns: textRuns.length
        ? textRuns
        : label
          ? [
              {
                text: label,
                bold: false,
                italic: false,
                underline: false,
                color: textColor,
                fontSize,
                fontFace,
              },
            ]
          : [],
    },
  ]
}

function extractGraphicFrameImage(
  element: ExtractedShapeElement,
  relationships: ExtractedRelationship[],
  supportParts: Record<string, ExtractedSupportPart>,
  id: string,
  sourcePath: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const relationshipId = element.relationshipIds?.find((candidate) => {
    const relationship = relationships.find((entry) => entry.Id === candidate)
    return relationship?.typeShort === 'image' || relationship?.Type?.includes('/image')
  })

  if (!relationshipId) {
    return undefined
  }

  const relationship = relationships.find((entry) => entry.Id === relationshipId)
  const supportPart = relationship?.resolvedTarget ? supportParts[relationship.resolvedTarget] : undefined
  const base64 = supportPart?.base64

  if (!relationship || !base64) {
    return undefined
  }

  const extension = (relationship.resolvedTarget || relationship.Target || '').split('.').pop()?.toLowerCase()
  const mimeType = extensionToMimeType(extension)
  if (!mimeType) {
    return undefined
  }

  const imageElement: NormalizedImageElement = {
    kind: 'image',
    id,
    sourcePath,
    opacity: 1,
    rotate: 0,
    valign: 'middle',
    x,
    y,
    w: Math.max(w, 1),
    h: Math.max(h, 1),
    src: `data:${mimeType};base64,${base64}`,
    fit: 'contain',
    borderRadius: 0,
    altText: element.nonVisual?.name || 'Embedded image',
  }
  return imageElement
}

function normalizeExtractedTextRuns(
  textBody: ExtractedTextBody | undefined,
  theme: Record<string, string>,
  styleNode: XmlNode | undefined,
) {
  const runs: NormalizedTextRun[] = []
  const defaultColor = parseFontColor(styleNode, theme, '111827')

  for (const paragraph of textBody?.paragraphs ?? []) {
    const paragraphRuns = paragraph.runs ?? []

    if (!paragraphRuns.length) {
      continue
    }

    paragraphRuns.forEach((run, runIndex) => {
      const properties = run.properties ?? {}
      runs.push({
        text: run.text ?? '',
        bold: properties.b === '1',
        italic: properties.i === '1',
        underline: !!properties.u && properties.u !== 'none',
        color: defaultColor,
        fontFace: DEFAULT_FONT_FACE,
        fontSize: properties.sz ? Number(properties.sz) / 100 : 16,
        breakLine: runIndex === paragraphRuns.length - 1,
      })
    })
  }

  if (!runs.length && textBody?.plainText) {
    runs.push({
      text: textBody.plainText,
      bold: false,
      italic: false,
      underline: false,
      color: defaultColor,
      fontFace: DEFAULT_FONT_FACE,
      fontSize: 16,
    })
  }

  return runs
}

function paragraphText(textBody: ExtractedTextBody | undefined) {
  const lines = (textBody?.paragraphs ?? [])
    .map((paragraph) => (paragraph.runs ?? []).map((run) => run.text ?? '').join(''))
    .filter((line) => line.trim().length > 0)

  if (lines.length) {
    return lines.join('\n')
  }

  return textBody?.plainText?.trim() ?? ''
}

function extractThemeColors(supportParts?: Record<string, ExtractedSupportPart>) {
  const rawXml = supportParts?.['ppt/theme/theme1.xml']?.rawXml
  if (!rawXml) {
    return DEFAULT_THEME
  }

  const theme = { ...DEFAULT_THEME }
  for (const key of Object.keys(DEFAULT_THEME)) {
    const match = rawXml.match(
      new RegExp(
        `<a:${key}>[\\s\\S]*?(?:<a:srgbClr val="([0-9A-Fa-f]{6})"\\/?>(?:[\\s\\S]*?)<\\/a:srgbClr>|<a:srgbClr val="([0-9A-Fa-f]{6})"\\s*\\/?>|<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"\\s*\\/?>)[\\s\\S]*?<\\/a:${key}>`,
      ),
    )
    const color = match?.[1] || match?.[2] || match?.[3]
    if (color) {
      theme[key] = color.toUpperCase()
    }
  }
  return theme
}

function deriveTitleFromExtractedSlide(input: ExtractedSlideSpec) {
  const titleCandidate = input.shapeTree?.elements
    ?.filter((element) => element.kind === 'shape' && !!paragraphText(element.text))
    .sort((left, right) => coerceNumber(left.transform?.yPx, 0) - coerceNumber(right.transform?.yPx, 0))[0]

  const title = paragraphText(titleCandidate?.text).replace(/\s+/g, ' ').trim()
  return title || `Slide ${input.slideNumber ?? 1}`
}

function parseLineColor(lineNode: XmlNode | undefined, theme: Record<string, string>, fallback: string) {
  if (!lineNode || hasChild(lineNode, 'a:noFill')) {
    return 'transparent'
  }

  return parseColor(findChild(lineNode, 'a:solidFill'), theme, fallback)
}

function parseFontColor(styleNode: XmlNode | undefined, theme: Record<string, string>, fallback: string) {
  const fontRef = findChild(styleNode, 'a:fontRef')
  if (!fontRef) {
    return fallback
  }

  const colorNode = (fontRef.children ?? []).find((child) => isColorTag(child.tag))
  return colorNode ? parseColorNode(colorNode, theme, fallback) : fallback
}

function parseColor(fillNode: XmlNode | undefined, theme: Record<string, string>, fallback: string) {
  if (!fillNode) {
    return fallback
  }

  const colorNode = (fillNode.children ?? []).find((child) => isColorTag(child.tag))
  return colorNode ? parseColorNode(colorNode, theme, fallback) : fallback
}

function parseColorNode(node: XmlNode, theme: Record<string, string>, fallback: string) {
  if (node.tag === 'a:srgbClr') {
    return cleanHex(node.attributes?.val, fallback)
  }

  if (node.tag === 'a:sysClr') {
    return cleanHex(node.attributes?.lastClr || node.attributes?.val, fallback)
  }

  if (node.tag === 'a:schemeClr') {
    const scheme = node.attributes?.val ?? ''
    const base = theme[mapSchemeColorKey(scheme)] || theme[scheme] || fallback
    return applyColorModifiers(cleanHex(base, fallback), node.children ?? [])
  }

  return fallback
}

function applyColorModifiers(baseHex: string, children: XmlNode[]) {
  let rgb = hexToRgb(baseHex)
  if (!rgb) {
    return baseHex
  }

  for (const child of children) {
    if (child.tag === 'a:shade') {
      const factor = Number(child.attributes?.val ?? '100000') / 100000
      rgb = rgb.map((channel) => Math.round(channel * factor)) as [number, number, number]
    }

    if (child.tag === 'a:tint') {
      const factor = Number(child.attributes?.val ?? '0') / 100000
      rgb = rgb.map((channel) => Math.round(channel + (255 - channel) * factor)) as [
        number,
        number,
        number,
      ]
    }
  }

  return rgbToHex(rgb)
}

function normalizeShapeName(shape: string | undefined) {
  if (!shape) {
    return 'rect'
  }

  return shapeAliases[shape] || shape
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

function normalizeBodyAnchor(value: string | undefined): VerticalAlign {
  if (value === 't') {
    return 'top'
  }

  if (value === 'b') {
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

function parseDashStyle(lineNode: XmlNode | undefined): DashStyle {
  const dashNode = findChild(lineNode, 'a:prstDash')
  return normalizeDash(dashNode?.attributes?.val)
}

function parseArrowType(lineNode: XmlNode | undefined): NormalizedLineElement['endArrow'] {
  const tailEnd = findChild(lineNode, 'a:tailEnd')
  return normalizeArrow(tailEnd?.attributes?.type)
}

function bodyPadding(bodyProperties: Record<string, string> | undefined) {
  const left = emuToPoints(bodyProperties?.lIns)
  const top = emuToPoints(bodyProperties?.tIns)
  const right = emuToPoints(bodyProperties?.rIns)
  const bottom = emuToPoints(bodyProperties?.bIns)
  const average = [left, top, right, bottom].filter((value) => value > 0)
  if (!average.length) {
    return 8
  }
  return average.reduce((sum, value) => sum + value, 0) / average.length
}

function emuLineWidthToPoints(value: string | undefined) {
  const width = Number(value)
  if (!Number.isFinite(width) || width <= 0) {
    return 1
  }
  return width / 12700
}

function emuToPoints(value: string | undefined) {
  const emu = Number(value)
  if (!Number.isFinite(emu) || emu <= 0) {
    return 0
  }
  return (emu / 914400) * 72
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

function mapSchemeColorKey(key: string) {
  if (key === 'tx1') {
    return 'dk1'
  }
  if (key === 'bg1') {
    return 'lt1'
  }
  if (key === 'tx2') {
    return 'dk2'
  }
  if (key === 'bg2') {
    return 'lt2'
  }
  return key
}

function extensionToMimeType(extension: string | undefined) {
  if (!extension) {
    return undefined
  }

  const normalized = extension.toLowerCase()
  if (normalized === 'png') {
    return 'image/png'
  }
  if (normalized === 'jpg' || normalized === 'jpeg') {
    return 'image/jpeg'
  }
  if (normalized === 'svg') {
    return 'image/svg+xml'
  }
  if (normalized === 'gif') {
    return 'image/gif'
  }
  if (normalized === 'emf') {
    return 'image/emf'
  }
  return undefined
}

function isColorTag(tag: string) {
  return tag === 'a:srgbClr' || tag === 'a:schemeClr' || tag === 'a:sysClr'
}

function findChild(node: XmlNode | undefined, tag: string) {
  return (node?.children ?? []).find((child) => child.tag === tag)
}

function hasChild(node: XmlNode | undefined, tag: string) {
  return !!findChild(node, tag)
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function coerceNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function hexToRgb(hex: string) {
  const normalized = cleanHex(hex, '')
  if (!normalized) {
    return undefined
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ] as [number, number, number]
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return [r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}
