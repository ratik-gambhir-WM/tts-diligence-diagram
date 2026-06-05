import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import westMonroeLogoImage from '../../assets/element-5.png'
import westMonroeSlideBackgroundImage from '../../assets/element-903000.jpg'

type UnknownRecord = Record<string, unknown>

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

interface ExtractedSlideSpec {
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
  occlusionRects: LineOcclusionRect[]
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

export interface LineOcclusionRect {
  x: number
  y: number
  w: number
  h: number
}

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
    sourceType: 'extracted-slide' | 'native-presentation'
  }
  slides: NormalizedSlide[]
}

export interface NormalizationOptions {
  baseDir?: string
}

type SlideForElementLayering = Pick<NormalizedSlide, 'elements' | 'height' | 'width'>

export interface PowerPointWriteOptions {
  fileName: string
  compression?: boolean
  insertAfterSlide?: number
  targetFile?: File
}

const DEFAULT_WIDTH_PX = 1280
const DEFAULT_HEIGHT_PX = 720
const DEFAULT_FONT_FACE = 'Arial'
const WEST_MONROE_THEME_NAME = 'west monroe 3'
const WEST_MONROE_THEME_FAMILY = '2024_West_Monroe_Template'
const WEST_MONROE_THEME_DISPLAY_NAME = 'Covers, agenda, content slides'
const WEST_MONROE_THEME_FAMILY_ID = '{C81014D0-DA20-1C43-A69C-43A00C88AFD4}'
const WEST_MONROE_THEME_VERSION_ID = '{F7E5B7F2-98A1-0648-ACD7-27DE9B03B0A8}'
const DEFAULT_THEME: Record<string, string> = {
  dk1: '070154',
  lt1: 'FFFFFF',
  dk2: '0047FF',
  lt2: 'F6EB20',
  accent1: 'F900D3',
  accent2: '50658E',
  accent3: 'CED7E6',
  accent4: 'E8EEF8',
  accent5: '00E8FA',
  accent6: '00A3FF',
  hlink: '0563C1',
  folHlink: '954F72',
}
const WEST_MONROE_CUSTOM_COLORS: Record<string, string> = {
  'Highlight Magenta': 'F900D3',
  'WM Light Blue': '00E8FA',
  'WM Green': '1DD566',
  'WM Gold': 'FFC700',
  'WM Purple': 'B741FF',
  'WM Light Green': '00FCB0',
  'WM Orange': 'FF8A00',
  'WM Blue': '00A3FF',
  'WM Red': 'F52C00',
  'WM Light Gray': 'E8EEF8',
  'WM Medium Gray': 'CED7E6',
  'WM Gray': '97A4BA',
}
const WEST_MONROE_LOGO_IMAGE_ID = 'element-5'
const WEST_MONROE_SLIDE_BACKGROUND_IMAGE_ID = 'element-903000'
const WEST_MONROE_LOGO_ASPECT_RATIO = 1436 / 300
const WEST_MONROE_LOGO_WIDTH_RATIO = 0.145
const WEST_MONROE_LOGO_LEFT_RATIO = 0.038
const WEST_MONROE_LOGO_BOTTOM_RATIO = 0.037

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

  if ('shapeTree' in input) {
    const presentation = normalizeExtractedPresentation(input as ExtractedSlideSpec, issues)
    return { presentation, issues }
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
  const output = options.targetFile
    ? await insertPptxBytesIntoExistingDeck(themed, options.targetFile, {
        compression: options.compression,
        insertAfterSlide: options.insertAfterSlide,
      })
    : {
        bytes: themed,
        fileName: options.fileName,
      }

  downloadPptxBytes(output.bytes, output.fileName)
}

export async function buildThemedPptxBytes(
  presentation: NormalizedPresentation,
  options: Pick<PowerPointWriteOptions, 'compression'> = {},
) {
  const pptx = buildPptxPresentation(presentation)
  const raw = await pptx.write({ outputType: 'uint8array', compression: options.compression ?? true })
  return applyDefaultThemeToPptx(raw, options)
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
  pptx.theme = {
    headFontFace: DEFAULT_FONT_FACE,
    bodyFontFace: DEFAULT_FONT_FACE,
  }

  for (const slideSpec of presentation.slides) {
    const slide = pptx.addSlide()
    slide.background = { color: cleanHex(slideSpec.backgroundColor, 'FFFFFF') }
    addWestMonroeBackgroundImages(slide, slideSpec)

    for (const element of slideSpec.elements) {
      if (element.kind === 'line') {
        const lineGeometry = toPptxLineGeometry(element)
        slide.addShape('line', {
          x: pxToInches(lineGeometry.x),
          y: pxToInches(lineGeometry.y),
          w: pxToInches(lineGeometry.w),
          h: pxToInches(lineGeometry.h),
          flipH: lineGeometry.flipH,
          flipV: lineGeometry.flipV,
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
        slide.addText(toPptxTextRuns(element.textRuns), {
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

function downloadPptxBytes(themed: Uint8Array, fileName: string) {
  const browser = globalThis as typeof globalThis & {
    document?: {
      body: { appendChild: (node: unknown) => void }
      createElement: (tag: 'a') => {
        href: string
        download: string
        style: { display: string }
        click: () => void
        remove: () => void
      }
    }
    URL?: {
      createObjectURL: (blob: unknown) => string
      revokeObjectURL: (url: string) => void
    }
    Blob?: new (parts: unknown[], options?: { type?: string }) => unknown
  }

  if (!browser.document || !browser.URL || !browser.Blob) {
    throw new Error('PowerPoint download is only available in a browser export context.')
  }

  const blob = new browser.Blob([themed], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  const link = browser.document.createElement('a')
  link.href = browser.URL.createObjectURL(blob)
  link.download = fileName
  link.style.display = 'none'
  browser.document.body.appendChild(link)
  link.click()
  link.remove()
  browser.URL.revokeObjectURL(link.href)
}

async function applyDefaultThemeToPptx(raw: unknown, options: Pick<PowerPointWriteOptions, 'compression'>) {
  const bytes = await toUint8Array(raw)
  const zip = await JSZip.loadAsync(bytes)
  const themePath = 'ppt/theme/theme1.xml'
  const existingTheme = await zip.file(themePath)?.async('text')

  if (existingTheme) {
    zip.file(themePath, applyDefaultThemeXml(existingTheme))
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: options.compression === false ? 'STORE' : 'DEFLATE',
  })
}

async function insertPptxBytesIntoExistingDeck(
  slideDeckBytes: Uint8Array,
  targetFile: File,
  options: Pick<PowerPointWriteOptions, 'compression' | 'insertAfterSlide'>,
) {
  if (!isPptxFile(targetFile)) {
    throw new Error('Choose a .pptx PowerPoint file before adding the slide.')
  }

  const targetZip = await JSZip.loadAsync(await targetFile.arrayBuffer())
  const sourceZip = await JSZip.loadAsync(slideDeckBytes)
  const presentationPath = 'ppt/presentation.xml'
  const presentationRelsPath = 'ppt/_rels/presentation.xml.rels'
  const contentTypesPath = '[Content_Types].xml'
  const presentationXml = await targetZip.file(presentationPath)?.async('text')
  const presentationRelsXml = await targetZip.file(presentationRelsPath)?.async('text')
  const contentTypesXml = await targetZip.file(contentTypesPath)?.async('text')

  if (!presentationXml || !presentationRelsXml || !contentTypesXml) {
    throw new Error('The selected PowerPoint file is missing required presentation metadata.')
  }

  const sourceSlideNumbers = listSlideNumbers(sourceZip)
  if (!sourceSlideNumbers.length) {
    throw new Error('No generated slide was available to add to the selected PowerPoint file.')
  }

  const targetSlideIds = parseSlideIdEntries(presentationXml)
  const insertAfterSlide = clampInteger(
    options.insertAfterSlide ?? targetSlideIds.length,
    0,
    targetSlideIds.length,
  )
  const targetLayout = await findDefaultSlideLayoutTarget(targetZip)
  let nextSlideNumber = Math.max(0, ...listSlideNumbers(targetZip)) + 1
  let nextSlideId = Math.max(255, ...targetSlideIds.map((slideId) => slideId.id)) + 1
  let presentationRels = parseRelationships(presentationRelsXml)
  let contentTypes = contentTypesXml
  const insertedSlideIdEntries: string[] = []

  for (const sourceSlideNumber of sourceSlideNumbers) {
    const sourceSlidePath = `ppt/slides/slide${sourceSlideNumber}.xml`
    const sourceSlideRelsPath = `ppt/slides/_rels/slide${sourceSlideNumber}.xml.rels`
    const sourceSlideXml = await sourceZip.file(sourceSlidePath)?.async('text')

    if (!sourceSlideXml) {
      continue
    }

    const targetSlideNumber = nextSlideNumber++
    const targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`
    const targetSlideRelsPath = `ppt/slides/_rels/slide${targetSlideNumber}.xml.rels`
    const newPresentationRelId = nextRelationshipId(presentationRels)
    const newSlideId = nextSlideId++

    targetZip.file(targetSlidePath, sourceSlideXml)
    const sourceSlideRelsXml = await sourceZip.file(sourceSlideRelsPath)?.async('text')
    const targetSlideRelsXml = sourceSlideRelsXml
      ? await rewriteSlideRelationships(sourceZip, targetZip, sourceSlideRelsXml, targetLayout)
      : buildRelationshipsXml([])
    targetZip.file(targetSlideRelsPath, targetSlideRelsXml)

    presentationRels = [
      ...presentationRels,
      {
        Id: newPresentationRelId,
        Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
        Target: `slides/slide${targetSlideNumber}.xml`,
      },
    ]
    contentTypes = ensureContentTypeOverride(
      contentTypes,
      `/${targetSlidePath}`,
      'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
    )
    contentTypes = ensureMediaContentTypes(contentTypes)
    insertedSlideIdEntries.push(`<p:sldId id="${newSlideId}" r:id="${newPresentationRelId}"/>`)
  }

  if (!insertedSlideIdEntries.length) {
    throw new Error('No generated slide could be copied into the selected PowerPoint file.')
  }

  targetZip.file(presentationPath, insertSlideIdEntries(presentationXml, insertedSlideIdEntries, insertAfterSlide))
  targetZip.file(presentationRelsPath, buildRelationshipsXml(presentationRels))
  targetZip.file(contentTypesPath, contentTypes)

  const bytes = await targetZip.generateAsync({
    type: 'uint8array',
    compression: options.compression === false ? 'STORE' : 'DEFLATE',
  })

  return {
    bytes,
    fileName: buildInsertedPowerPointFileName(targetFile.name),
  }
}

interface PptxRelationship {
  Id: string
  Type: string
  Target: string
  TargetMode?: string
}

function isPptxFile(file: File) {
  return (
    file.name.toLowerCase().endsWith('.pptx') &&
    (!file.type ||
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  )
}

function listSlideNumbers(zip: JSZip) {
  return Object.keys(zip.files)
    .map((path) => path.match(/^ppt\/slides\/slide(\d+)\.xml$/u)?.[1])
    .filter(isDefined)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right)
}

function parseSlideIdEntries(presentationXml: string) {
  return Array.from(presentationXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"[^>]*\br:id="([^"]+)"[^/]*\/>/gu))
    .map((match) => ({
      id: Number(match[1]),
      relationshipId: match[2],
    }))
    .filter((entry) => Number.isInteger(entry.id) && !!entry.relationshipId)
}

function insertSlideIdEntries(
  presentationXml: string,
  slideIdEntries: string[],
  insertAfterSlide: number,
) {
  const listMatch = presentationXml.match(/<p:sldIdLst\b[^>]*>[\s\S]*?<\/p:sldIdLst>/u)
  if (!listMatch || listMatch.index === undefined) {
    throw new Error('The selected PowerPoint file is missing a slide list.')
  }

  const listXml = listMatch[0]
  const openingMatch = listXml.match(/^<p:sldIdLst\b[^>]*>/u)
  if (!openingMatch) {
    throw new Error('The selected PowerPoint slide list could not be parsed.')
  }

  const slideMatches = Array.from(listXml.matchAll(/<p:sldId\b[^>]*\/>/gu))
  const boundedInsertAfterSlide = clampInteger(insertAfterSlide, 0, slideMatches.length)
  const insertionPoint =
    boundedInsertAfterSlide === 0
      ? openingMatch[0].length
      : (slideMatches[boundedInsertAfterSlide - 1]?.index ?? 0) +
        (slideMatches[boundedInsertAfterSlide - 1]?.[0].length ?? 0)
  const updatedListXml = `${listXml.slice(0, insertionPoint)}${slideIdEntries.join('')}${listXml.slice(insertionPoint)}`

  return `${presentationXml.slice(0, listMatch.index)}${updatedListXml}${presentationXml.slice(
    listMatch.index + listXml.length,
  )}`
}

function parseRelationships(xml: string): PptxRelationship[] {
  return Array.from(xml.matchAll(/<Relationship\b([^>]*)\/>/gu))
    .map((match) => parseXmlAttributes(match[1]))
    .filter(
      (attributes): attributes is PptxRelationship =>
        !!attributes.Id && !!attributes.Type && !!attributes.Target,
    )
}

function buildRelationshipsXml(relationships: PptxRelationship[]) {
  const relationshipXml = relationships
    .map((relationship) => {
      const targetMode = relationship.TargetMode
        ? ` TargetMode="${escapeXml(relationship.TargetMode)}"`
        : ''
      return `<Relationship Id="${escapeXml(relationship.Id)}" Type="${escapeXml(
        relationship.Type,
      )}" Target="${escapeXml(relationship.Target)}"${targetMode}/>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipXml}</Relationships>`
}

function parseXmlAttributes(attributesXml: string) {
  const attributes: Record<string, string> = {}
  for (const match of attributesXml.matchAll(/([\w:.-]+)="([^"]*)"/gu)) {
    attributes[match[1]] = unescapeXmlAttribute(match[2])
  }
  return attributes
}

function nextRelationshipId(relationships: PptxRelationship[]) {
  const used = new Set(relationships.map((relationship) => relationship.Id))
  let next = Math.max(
    0,
    ...relationships
      .map((relationship) => relationship.Id.match(/^rId(\d+)$/u)?.[1])
      .filter(isDefined)
      .map((value) => Number(value)),
  ) + 1

  while (used.has(`rId${next}`)) {
    next += 1
  }

  return `rId${next}`
}

async function findDefaultSlideLayoutTarget(zip: JSZip) {
  const firstSlideNumber = listSlideNumbers(zip)[0]
  if (!firstSlideNumber) {
    return undefined
  }

  const relsXml = await zip.file(`ppt/slides/_rels/slide${firstSlideNumber}.xml.rels`)?.async('text')
  const layoutRelationship = relsXml
    ? parseRelationships(relsXml).find((relationship) => relationship.Type.endsWith('/slideLayout'))
    : undefined

  return layoutRelationship?.Target
}

async function rewriteSlideRelationships(
  sourceZip: JSZip,
  targetZip: JSZip,
  sourceSlideRelsXml: string,
  targetLayout: string | undefined,
) {
  const rewrittenRelationships: PptxRelationship[] = []

  for (const relationship of parseRelationships(sourceSlideRelsXml)) {
    if (relationship.Type.endsWith('/slideLayout') && targetLayout) {
      rewrittenRelationships.push({
        ...relationship,
        Target: targetLayout,
      })
      continue
    }

    if (relationship.Type.includes('/image')) {
      const copiedMediaTarget = await copySlideRelationshipMedia(sourceZip, targetZip, relationship.Target)
      if (copiedMediaTarget) {
        rewrittenRelationships.push({
          ...relationship,
          Target: copiedMediaTarget,
        })
      }
      continue
    }

    rewrittenRelationships.push(relationship)
  }

  return buildRelationshipsXml(rewrittenRelationships)
}

async function copySlideRelationshipMedia(sourceZip: JSZip, targetZip: JSZip, relationshipTarget: string) {
  const sourcePath = resolvePptxPartPath('ppt/slides', relationshipTarget)
  const sourceFile = sourceZip.file(sourcePath)
  if (!sourceFile) {
    return undefined
  }

  const extension = sourcePath.split('.').pop()?.toLowerCase() || 'bin'
  const targetFileName = nextMediaFileName(targetZip, extension)
  targetZip.file(`ppt/media/${targetFileName}`, await sourceFile.async('uint8array'))
  return `../media/${targetFileName}`
}

function nextMediaFileName(zip: JSZip, extension: string) {
  const escapedExtension = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const existingNumbers = Object.keys(zip.files)
    .map((path) => path.match(new RegExp(`^ppt/media/image(\\d+)\\.${escapedExtension}$`, 'u'))?.[1])
    .filter(isDefined)
    .map((value) => Number(value))
  const nextNumber = Math.max(0, ...existingNumbers) + 1
  return `image${nextNumber}.${extension}`
}

function resolvePptxPartPath(basePath: string, target: string) {
  const segments = [...basePath.split('/'), ...target.split('/')]
  const resolved: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      resolved.pop()
      continue
    }
    resolved.push(segment)
  }

  return resolved.join('/')
}

function ensureContentTypeOverride(xml: string, partName: string, contentType: string) {
  if (xml.includes(`PartName="${partName}"`)) {
    return xml
  }

  return xml.replace(
    '</Types>',
    `<Override PartName="${escapeXml(partName)}" ContentType="${escapeXml(contentType)}"/></Types>`,
  )
}

function ensureMediaContentTypes(xml: string) {
  return [
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
  ].reduce((updatedXml, [extension, contentType]) => {
    if (new RegExp(`<Default\\b[^>]*Extension="${extension}"`, 'u').test(updatedXml)) {
      return updatedXml
    }

    return updatedXml.replace(
      '</Types>',
      `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`,
    )
  }, xml)
}

function buildInsertedPowerPointFileName(fileName: string) {
  const trimmed = fileName.trim()
  const stem = trimmed.toLowerCase().endsWith('.pptx') ? trimmed.slice(0, -5) : trimmed
  return `${stem || 'presentation'}-with-slide.pptx`
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return max
  }

  return Math.max(min, Math.min(max, Math.trunc(value)))
}

async function toUint8Array(raw: unknown) {
  if (raw instanceof Uint8Array) {
    return raw
  }

  if (typeof ArrayBuffer !== 'undefined' && raw instanceof ArrayBuffer) {
    return new Uint8Array(raw)
  }

  if (isRecord(raw) && typeof raw.arrayBuffer === 'function') {
    return new Uint8Array(await raw.arrayBuffer())
  }

  if (typeof raw === 'string') {
    return new TextEncoder().encode(raw)
  }

  throw new Error('PowerPoint export returned an unsupported binary output type.')
}

function applyDefaultThemeXml(xml: string) {
  const themed = xml
    .replace(/<a:theme([^>]*)name="[^"]*"/u, `<a:theme$1name="${WEST_MONROE_THEME_DISPLAY_NAME}"`)
    .replace(/<a:clrScheme\b[^>]*>[\s\S]*?<\/a:clrScheme>/u, buildThemeColorSchemeXml())
    .replace(/<a:fontScheme\b[^>]*>/u, '<a:fontScheme name="Arial">')
    .replace(/<a:majorFont><a:latin\b[^>]*\/>/u, '<a:majorFont><a:latin typeface="Arial"/>')
    .replace(/<a:minorFont><a:latin\b[^>]*\/>/u, '<a:minorFont><a:latin typeface="Arial"/>')
    .replace(
      /<thm15:themeFamily\b([^>]*)name="[^"]*"/u,
      `<thm15:themeFamily$1name="${WEST_MONROE_THEME_FAMILY}"`,
    )
    .replace(/(<thm15:themeFamily\b[^>]*\bid=")[^"]*"/u, `$1${WEST_MONROE_THEME_FAMILY_ID}"`)
    .replace(/(<thm15:themeFamily\b[^>]*\bvid=")[^"]*"/u, `$1${WEST_MONROE_THEME_VERSION_ID}"`)

  return upsertCustomColorList(themed)
}

function buildThemeColorSchemeXml() {
  const colorXml = Object.entries(DEFAULT_THEME)
    .map(([name, color]) => `<a:${name}><a:srgbClr val="${color}"/></a:${name}>`)
    .join('')
  return `<a:clrScheme name="${WEST_MONROE_THEME_NAME}">${colorXml}</a:clrScheme>`
}

function upsertCustomColorList(xml: string) {
  const customColorXml = `<a:custClrLst>${Object.entries(WEST_MONROE_CUSTOM_COLORS)
    .map(([name, color]) => `<a:custClr name="${escapeXml(name)}"><a:srgbClr val="${color}"/></a:custClr>`)
    .join('')}</a:custClrLst>`

  if (/<a:custClrLst>[\s\S]*?<\/a:custClrLst>/u.test(xml)) {
    return xml.replace(/<a:custClrLst>[\s\S]*?<\/a:custClrLst>/u, customColorXml)
  }

  if (xml.includes('<a:extLst>')) {
    return xml.replace('<a:extLst>', `${customColorXml}<a:extLst>`)
  }

  return xml.replace('</a:theme>', `${customColorXml}</a:theme>`)
}

function toPptxLineGeometry(element: NormalizedLineElement) {
  return {
    x: Math.min(element.x1, element.x2),
    y: Math.min(element.y1, element.y2),
    w: Math.abs(element.x2 - element.x1),
    h: Math.abs(element.y2 - element.y1),
    flipH: element.x2 < element.x1,
    flipV: element.y2 < element.y1,
  }
}

function addWestMonroeBackgroundImages(
  slide: ReturnType<PptxGenJS['addSlide']>,
  slideSpec: NormalizedSlide,
) {
  slide.addImage({
    path: westMonroeSlideBackgroundImage,
    x: 0,
    y: 0,
    w: pxToInches(slideSpec.width),
    h: pxToInches(slideSpec.height),
    altText: 'West Monroe slide background',
  })

  const logoWidth = slideSpec.width * WEST_MONROE_LOGO_WIDTH_RATIO
  const logoHeight = logoWidth / WEST_MONROE_LOGO_ASPECT_RATIO
  slide.addImage({
    path: westMonroeLogoImage,
    x: pxToInches(slideSpec.width * WEST_MONROE_LOGO_LEFT_RATIO),
    y: pxToInches(slideSpec.height - logoHeight - slideSpec.height * WEST_MONROE_LOGO_BOTTOM_RATIO),
    w: pxToInches(logoWidth),
    h: pxToInches(logoHeight),
    altText: 'West Monroe logo',
  })
}

export function getConnectorAwareElementOrder(slide: SlideForElementLayering) {
  return slide.elements
    .map((element, index) => ({
      element,
      index,
      layer: getConnectorAwareLayer(element, slide),
    }))
    .sort((a, b) => a.layer - b.layer || a.index - b.index)
    .map(({ element }) => element)
}

function getConnectorAwareLayer(element: NormalizedElement, slide: SlideForElementLayering) {
  if (isSlideContainerElement(element, slide)) {
    return 10
  }

  if (element.kind === 'line') {
    return 20
  }

  return 30
}

function isSlideContainerElement(element: NormalizedElement, slide: SlideForElementLayering) {
  if (element.kind !== 'shape' || element.shape !== 'rect') {
    return false
  }

  const slideArea = Math.max(slide.width * slide.height, 1)
  const elementArea = Math.max(element.w * element.h, 0)
  const coversLargeRegion = elementArea / slideArea >= 0.08
  const coversTallLane = element.h / slide.height >= 0.45 && element.w / slide.width >= 0.12

  return coversLargeRegion || coversTallLane
}

function addConnectorOcclusionRects(
  elements: NormalizedElement[],
  slide: Pick<NormalizedSlide, 'height' | 'width'>,
): NormalizedElement[] {
  const slideForLayering = { ...slide, elements }
  const occlusionRects = elements
    .filter((element): element is Exclude<NormalizedElement, NormalizedLineElement> =>
      element.kind !== 'line' && !isSlideContainerElement(element, slideForLayering),
    )
    .map(getElementBounds)

  return elements.map((element) => {
    if (element.kind !== 'line') {
      return element
    }

    return {
      ...element,
      occlusionRects,
    }
  })
}

function getElementBounds(element: Exclude<NormalizedElement, NormalizedLineElement>): LineOcclusionRect {
  return {
    h: element.h,
    w: element.w,
    x: element.x,
    y: element.y,
  }
}

function normalizeExtractedPresentation(
  input: ExtractedSlideSpec,
  issues: ValidationIssue[],
): NormalizedPresentation {
  const width = coerceNumber(input.slideSize?.widthPx, DEFAULT_WIDTH_PX)
  const height = coerceNumber(input.slideSize?.heightPx, DEFAULT_HEIGHT_PX)
  const theme = extractThemeColors(input.supportParts)
  const slideId = `slide-${input.slideNumber ?? 1}`
  const slideName = deriveTitleFromExtractedSlide(input)
  const normalizedElements = (input.shapeTree?.elements ?? [])
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
  const elements = addConnectorOcclusionRects(normalizedElements, { height, width })

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

  if ('shapeTree' in input) {
    return normalizeExtractedPresentation(input as ExtractedSlideSpec, issues).slides[0]
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
        occlusionRects: [],
      },
    ]
  }

  if (element.kind === 'graphicFrame') {
    const image = extractGraphicFrameImage(element, relationships, supportParts, theme, id, sourcePath, x, y, w, h)
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
  const hasNoFill = hasChild(element.shapeProperties, 'a:noFill')
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
  theme: Record<string, string>,
  id: string,
  sourcePath: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  void theme
  void supportParts
  const relationshipId = element.relationshipIds?.find((candidate) => {
    const relationship = relationships.find((entry) => entry.Id === candidate)
    return relationship?.typeShort === 'image' || relationship?.Type?.includes('/image')
  })

  if (!relationshipId) {
    return undefined
  }

  const relationship = relationships.find((entry) => entry.Id === relationshipId)
  const src = relationship ? getHardcodedExtractedImageSrc(element, relationship) : undefined

  if (!src) {
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
    src,
    fit: 'contain',
    borderRadius: 0,
    altText: element.nonVisual?.name || 'Embedded image',
  }
  return imageElement
}

function getHardcodedExtractedImageSrc(
  element: ExtractedShapeElement,
  relationship: ExtractedRelationship,
) {
  const candidates = [
    element.nonVisual?.id?.toString(),
    element.nonVisual?.name,
    element.path,
    relationship.resolvedTarget,
    relationship.Target,
  ]

  if (candidates.some((candidate) => matchesExtractedImageAsset(candidate, WEST_MONROE_LOGO_IMAGE_ID))) {
    return westMonroeLogoImage
  }

  if (
    candidates.some((candidate) =>
      matchesExtractedImageAsset(candidate, WEST_MONROE_SLIDE_BACKGROUND_IMAGE_ID),
    )
  ) {
    return westMonroeSlideBackgroundImage
  }

  const extension = (relationship.resolvedTarget || relationship.Target || '').split('.').pop()?.toLowerCase()
  if (extension === 'png') {
    return westMonroeLogoImage
  }
  if (extension === 'jpg' || extension === 'jpeg') {
    return westMonroeSlideBackgroundImage
  }

  return undefined
}

function matchesExtractedImageAsset(value: string | undefined, assetId: string) {
  if (!value) {
    return false
  }

  const normalizedValue = value.toLowerCase()
  const numericId = assetId.replace('element-', '')
  return (
    normalizedValue === assetId ||
    normalizedValue === numericId ||
    new RegExp(`(^|[^a-z0-9])${assetId}([^a-z0-9]|$)`, 'u').test(normalizedValue)
  )
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

function toPptxTextRuns(runs: NormalizedTextRun[]) {
  return runs.map((run) => ({
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline ? {} : undefined,
      breakLine: run.breakLine,
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

function normalizeBodyAnchor(value: string | undefined): VerticalAlign {
  if (value === 't') {
    return 'top'
  }

  if (value === 'b') {
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

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
