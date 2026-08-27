import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import JSZip from 'jszip'
import { normalizePresentationSpec } from '../export/PowerpointNormalizer'
import type {
  NormalizedElement,
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedShapeElement,
  NormalizedTextElement,
  NormalizedTextRun,
} from '../export/PowerpointTypes'

/**
 * Converts PowerPoint OOXML directly into the native object consumed by
 * <SvgSlideCanvas input={template.jsonSpec} />. The compact output is also
 * accepted by the existing JSON-to-PowerPoint exporter.
 */

type XmlNode = {
  tag: string
  attributes?: Record<string, string>
  children?: XmlNode[]
  text?: string
}

type ExtractedRelationship = {
  Id: string
  Type?: string
  Target?: string
  resolvedTarget?: string
  typeShort?: string
}

type TransformMatrix = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

type ExtractedElementRecord = Record<string, unknown> & {
  relationshipIds?: string[]
  text?: unknown
}

type ExtractedTextRunRecord = {
  text?: string
  properties?: Record<string, string>
}

type ExtractedTextBodyRecord = {
  paragraphs?: Array<{
    runs?: ExtractedTextRunRecord[]
  }>
  plainText?: string
}

type ExtractedSlideRecord = {
  shapeTree?: {
    elements?: ExtractedElementRecord[]
  }
  supportParts?: Record<string, { rawXml?: string }>
  backgroundColor?: string
}

type SlideSize = {
  cx: number
  cy: number
  widthPx: number
  heightPx: number
}

type ThemeTypography = {
  bodyFont: string
  headingFont: string
  colors: Record<string, string>
}

type PlaceholderSourceIndex = {
  layout: XmlNode[]
  master: XmlNode[]
}

type JsonRecord = Record<string, unknown>

export type PowerPointCanvasJson = {
  presentation: {
    title: string
    preserveElementOrder: boolean
    showBranding: boolean
    slides: Array<{
      id: string
      name: string
      width: number
      height: number
      backgroundColor: string
      elements: JsonRecord[]
    }>
  }
}

export type ImportPowerPointOptions = {
  /** Path to the source .pptx. Relative paths resolve from workingDirectory. */
  inputPath: string
  /** JSON file or destination directory. Defaults beside the source deck. */
  outputPath?: string
  /** One-based slide number. Omit to import the complete deck. */
  slide?: number
  /** Keep image data in the returned JSON instead of writing an assets directory. */
  embedAssets?: boolean
  /** Base directory for relative input and output paths. Defaults to process.cwd(). */
  workingDirectory?: string
}

export type ImportPowerPointResult = {
  inputPath: string
  outputPath: string
  jsonSpec: PowerPointCanvasJson
  warnings: string[]
  sourceSlideCount: number
  importedSlideCount: number
}

const EMU_PER_INCH = 914400
const PX_PER_INCH = 96
const DEFAULT_OUTPUT_SUFFIX = '.canvas.json'

/**
 * Imports a PowerPoint deck into the compact object consumed by TemplateCanvas.
 * This is the single public entry point; the OOXML parsing helpers below remain
 * private implementation details.
 */
export async function importPowerPoint(
  options: ImportPowerPointOptions,
): Promise<ImportPowerPointResult> {
  if (!options.inputPath.trim()) {
    throw new Error('inputPath is required.')
  }
  if (options.slide !== undefined && (!Number.isInteger(options.slide) || options.slide < 1)) {
    throw new Error('slide must be a positive whole slide number.')
  }

  const workingDirectory = path.resolve(options.workingDirectory ?? process.cwd())
  const inputPath = path.resolve(workingDirectory, options.inputPath)
  const outputPath = resolveJsonOutputPath(inputPath, options.outputPath, workingDirectory)
  const outputDir = path.dirname(outputPath)
  const zip = await JSZip.loadAsync(await readFile(inputPath))
  const presentationXml = await readZipText(zip, 'ppt/presentation.xml')
  const presentationRels = parseRelationships(
    await readZipText(zip, 'ppt/_rels/presentation.xml.rels'),
    'ppt',
  )
  const slideSize = extractSlideSize(presentationXml)
  const slidePaths = extractSlidePaths(presentationXml, presentationRels)

  if (!slidePaths.length) {
    throw new Error('No slides were found in the PowerPoint deck.')
  }

  const selectedSlides = options.slide
    ? slidePaths.slice(options.slide - 1, options.slide)
    : slidePaths

  if (options.slide && selectedSlides.length === 0) {
    throw new Error(`Slide ${options.slide} does not exist. The deck has ${slidePaths.length} slide(s).`)
  }

  await mkdir(outputDir, { recursive: true })

  const warnings: string[] = []
  const normalizedSlides: NormalizedPresentation['slides'] = []
  let deckTitle = path.basename(inputPath, path.extname(inputPath))

  for (const slidePath of selectedSlides) {
    const slideNumber = slidePaths.indexOf(slidePath) + 1
    const extracted = await extractSlide(zip, inputPath, slidePath, slideNumber, slideSize)
    const { presentation, issues } = normalizePresentationSpec(extracted, {
      baseDir: outputDir,
    })
    const errors = issues.filter((issue) => issue.level === 'error')

    if (!presentation || errors.length) {
      const formatted = issues
        .map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`)
        .join('\n')
      throw new Error(`Slide ${slideNumber} could not be normalized.\n${formatted}`)
    }

    warnings.push(
      ...issues
        .filter((issue) => issue.level === 'warning')
        .map((issue) => `slide ${slideNumber}: ${issue.path}: ${issue.message}`),
    )

    applyExtractedTypography(presentation, extracted)
    normalizedSlides.push(...presentation.slides)
    if (normalizedSlides.length === 1) {
      deckTitle = presentation.meta.title || deckTitle
    }
  }

  const compact = await compactPresentation(
    {
      meta: {
        title: deckTitle,
        width: slideSize.widthPx,
        height: slideSize.heightPx,
        preserveElementOrder: true,
        showBranding: false,
        sourceType: 'native-presentation',
      },
      slides: normalizedSlides,
    },
    outputPath,
    { embedAssets: options.embedAssets },
  )
  const roundTrip = normalizePresentationSpec(compact, { baseDir: outputDir })
  const roundTripErrors = roundTrip.issues.filter((issue) => issue.level === 'error')
  if (!roundTrip.presentation || roundTripErrors.length) {
    throw new Error(
      `Generated JSON failed the TemplateCanvas contract:\n${roundTripErrors
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('\n')}`,
    )
  }
  await writeFile(outputPath, `${JSON.stringify(compact, null, 2)}\n`, 'utf8')

  return {
    inputPath,
    outputPath,
    jsonSpec: compact,
    warnings,
    sourceSlideCount: slidePaths.length,
    importedSlideCount: normalizedSlides.length,
  }
}

function resolveJsonOutputPath(
  inputPath: string,
  outputArg: string | undefined,
  workingDirectory: string,
) {
  if (!outputArg) {
    return path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}${DEFAULT_OUTPUT_SUFFIX}`,
    )
  }

  const resolved = path.resolve(workingDirectory, outputArg)
  if (path.extname(resolved).toLowerCase() === '.json') {
    return resolved
  }

  return path.join(
    resolved,
    `${path.basename(inputPath, path.extname(inputPath))}${DEFAULT_OUTPUT_SUFFIX}`,
  )
}

async function extractSlide(
  zip: JSZip,
  sourcePptx: string,
  slidePath: string,
  slideNumber: number,
  slideSize: SlideSize,
) {
  const slideXml = await readZipText(zip, slidePath)
  const relationshipsPath = relationshipPathFor(slidePath)
  const rawRelationshipsXml = await maybeReadZipText(zip, relationshipsPath)
  const relationships = rawRelationshipsXml
    ? parseRelationships(rawRelationshipsXml, path.posix.dirname(slidePath))
    : []
  const slideAst = parseXml(slideXml)
  const inherited = await extractInheritedSlideParts(zip, relationships, slideSize)
  const showMasterShapes = findDescendant(slideAst, 'p:sld')?.attributes?.showMasterSp !== '0'
  const slideBackgroundElement = extractBackgroundImageElement(
    slideAst,
    slidePath,
    'Slide',
    -2500,
    slideSize,
  )
  const shapeTree = findDescendant(slideAst, 'p:spTree')
  const slideElements = shapeTree
    ? extractShapeTreeElements(
        shapeTree,
        identityTransform(),
        slidePath,
        inherited.placeholderSources,
      )
    : []
  const baseElements = [
    ...(showMasterShapes ? inherited.masterElements : []),
    ...inherited.layoutElements,
    ...(slideBackgroundElement ? [slideBackgroundElement] : []),
  ]
  const elements = [
    ...baseElements,
    ...slideElements.map((element) => ({
      ...element,
      zIndex: coerceNumber(element.zIndex, 0) + baseElements.length,
    })),
  ]
  const allRelationships = [...inherited.relationships, ...relationships]

  return {
    sourcePptx,
    slideNumber,
    slidePath,
    relationshipsPath,
    relationships: allRelationships,
    rawRelationshipsXml,
    relationshipIds: Array.from(new Set(elements.flatMap((element) => element.relationshipIds ?? []))),
    slideSize: {
      cx: slideSize.cx,
      cy: slideSize.cy,
      widthInches: round(slideSize.cx / EMU_PER_INCH, 4),
      heightInches: round(slideSize.cy / EMU_PER_INCH, 4),
      widthPx: slideSize.widthPx,
      heightPx: slideSize.heightPx,
    },
    shapeTree: {
      elements,
    },
    supportParts: await collectSupportParts(zip, allRelationships),
    backgroundColor: extractBackgroundColor(slideAst) || inherited.backgroundColor,
    rawXml: slideXml,
    summary: {
      totalDrawableElements: elements.length,
      textElementCount: elements.filter((element) => !!paragraphText(element.text)).length,
    },
  }
}

async function extractInheritedSlideParts(
  zip: JSZip,
  slideRelationships: ExtractedRelationship[],
  slideSize: SlideSize,
) {
  const layoutRelationship = slideRelationships.find((relationship) =>
    relationship.Type?.includes('/slideLayout'),
  )
  const layout = layoutRelationship?.resolvedTarget
    ? await extractRelatedDrawablePart(zip, layoutRelationship.resolvedTarget, 'layout', -2000, slideSize)
    : emptyDrawablePart()
  const masterRelationship = layout.rawRelationships.find((relationship) =>
    relationship.Type?.includes('/slideMaster'),
  )
  const master = masterRelationship?.resolvedTarget
    ? await extractRelatedDrawablePart(zip, masterRelationship.resolvedTarget, 'master', -3000, slideSize)
    : emptyDrawablePart()

  return {
    masterElements: layout.showMasterShapes ? master.elements : [],
    layoutElements: layout.elements,
    relationships: [...master.relationships, ...layout.relationships],
    backgroundColor: layout.backgroundColor || master.backgroundColor,
    placeholderSources: {
      layout: layout.placeholderNodes,
      master: master.placeholderNodes,
    },
  }
}

async function extractRelatedDrawablePart(
  zip: JSZip,
  partPath: string,
  label: string,
  zOffset: number,
  slideSize: SlideSize,
) {
  const rawXml = await maybeReadZipText(zip, partPath)
  if (!rawXml) {
    return emptyDrawablePart()
  }

  const relationshipsPath = relationshipPathFor(partPath)
  const rawRelationshipsXml = await maybeReadZipText(zip, relationshipsPath)
  const relationships = rawRelationshipsXml
    ? parseRelationships(rawRelationshipsXml, path.posix.dirname(partPath))
    : []
  const scopedRelationships = relationships.map((relationship) => ({
    ...relationship,
    Id: scopedRelationshipId(partPath, relationship.Id),
  }))
  const partAst = parseXml(rawXml)
  const backgroundElement = extractBackgroundImageElement(
    partAst,
    `${partPath}#${label}`,
    `${label[0]?.toUpperCase() ?? ''}${label.slice(1)}`,
    zOffset - 1000,
    slideSize,
    partPath,
  )
  const shapeTree = findDescendant(partAst, 'p:spTree')
  const placeholderNodes = shapeTree
    ? descendants(shapeTree, 'p:sp').filter((node) => !!extractNonVisual(node).placeholder)
    : []
  const drawableElements = shapeTree
    ? extractShapeTreeElements(shapeTree, identityTransform(), `${partPath}#${label}`).map((element) => ({
        ...element,
        relationshipIds: element.relationshipIds?.map((relationshipId) =>
          scopedRelationshipId(partPath, relationshipId),
        ),
        zIndex: zOffset + coerceNumber(element.zIndex, 0),
      }))
    : []
  const elements = [
    ...(backgroundElement ? [backgroundElement] : []),
    ...drawableElements,
  ].filter((element) => shouldKeepInheritedElement(element, scopedRelationships, slideSize))

  return {
    elements,
    relationships: scopedRelationships,
    rawRelationships: relationships,
    backgroundColor: extractBackgroundColor(partAst),
    placeholderNodes,
    showMasterShapes: findDescendant(partAst, 'p:sldLayout')?.attributes?.showMasterSp !== '0',
  }
}

function extractBackgroundImageElement(
  root: XmlNode,
  pathLabel: string,
  label: string,
  zIndex: number,
  slideSize: SlideSize,
  relationshipScope?: string,
): ExtractedElementRecord | undefined {
  const background = findDescendant(root, 'p:bg')
  const blipFill = findDescendant(background, 'a:blipFill')
  const blip = findDescendant(blipFill, 'a:blip')
  const relationshipId = blip?.attributes?.['r:embed'] || blip?.attributes?.['r:link']

  if (!relationshipId) {
    return undefined
  }

  const scopedId = relationshipScope ? scopedRelationshipId(relationshipScope, relationshipId) : relationshipId
  const id = 900000 + Math.abs(Math.trunc(zIndex))

  return {
    path: `${pathLabel}#background-image`,
    zIndex,
    tag: 'p:bg',
    kind: 'graphicFrame',
    nonVisual: {
      id,
      name: `${label} Background Image`,
    },
    transform: {
      xPx: 0,
      yPx: 0,
      widthPx: slideSize.widthPx,
      heightPx: slideSize.heightPx,
      rotation: 0,
      xInches: 0,
      yInches: 0,
      widthInches: round(slideSize.widthPx / PX_PER_INCH, 4),
      heightInches: round(slideSize.heightPx / PX_PER_INCH, 4),
    },
    relationshipIds: [scopedId],
    xmlAst: background,
  }
}

function emptyDrawablePart() {
  return {
    elements: [] as ExtractedElementRecord[],
    relationships: [] as ExtractedRelationship[],
    rawRelationships: [] as ExtractedRelationship[],
    backgroundColor: undefined as string | undefined,
    placeholderNodes: [] as XmlNode[],
    showMasterShapes: true,
  }
}

function scopedRelationshipId(partPath: string, relationshipId: string) {
  return `${partPath}:${relationshipId}`
}

function shouldKeepInheritedElement(
  element: ExtractedElementRecord,
  relationships: ExtractedRelationship[],
  slideSize?: SlideSize,
) {
  const nonVisual = element.nonVisual as { placeholder?: { type?: string; idx?: string } } | undefined

  if (nonVisual?.placeholder) {
    return false
  }

  const text = paragraphText(element.text).replace(/\s+/g, ' ').trim().toLowerCase()
  if (
    text.includes('click to edit master') ||
    text.includes('edit master text styles') ||
    text.includes('master title style')
  ) {
    return false
  }

  if (element.kind === 'graphicFrame') {
    return (element.relationshipIds ?? []).every((relationshipId) => {
      const relationship = relationships.find((entry) => entry.Id === relationshipId)
      const extension = (relationship?.resolvedTarget || relationship?.Target || '').split('.').pop()?.toLowerCase()
      return extension !== 'emf' && extension !== 'wmf'
    })
  }

  if (slideSize && isCompletelyOutsideSlide(element, slideSize)) {
    return false
  }

  return true
}

function isCompletelyOutsideSlide(element: ExtractedElementRecord, slideSize: SlideSize) {
  const transform = element.transform as { xPx?: number; yPx?: number; widthPx?: number; heightPx?: number } | undefined
  const x = coerceNumber(transform?.xPx, 0)
  const y = coerceNumber(transform?.yPx, 0)
  const width = coerceNumber(transform?.widthPx, 0)
  const height = coerceNumber(transform?.heightPx, 0)
  const tolerance = 1

  return (
    x + width < -tolerance ||
    y + height < -tolerance ||
    x > slideSize.widthPx + tolerance ||
    y > slideSize.heightPx + tolerance
  )
}

function extractShapeTreeElements(
  parent: XmlNode,
  matrix: TransformMatrix,
  pathLabel: string,
  placeholderIndex?: PlaceholderSourceIndex,
) {
  const elements: ExtractedElementRecord[] = []

  for (const node of parent.children ?? []) {
    if (node.tag === 'p:grpSp') {
      const groupMatrix = composeTransform(matrix, groupTransform(node))
      elements.push(...extractShapeTreeElements(node, groupMatrix, pathLabel, placeholderIndex))
      continue
    }

    if (!['p:sp', 'p:cxnSp', 'p:pic', 'p:graphicFrame'].includes(node.tag)) {
      continue
    }

    if (node.tag === 'p:graphicFrame' && findDescendant(node, 'a:tbl')) {
      elements.push(...extractTableElements(node, matrix, pathLabel, elements.length))
      continue
    }

    const nonVisual = extractNonVisual(node)
    const placeholderSources = findPlaceholderSources(nonVisual.placeholder, placeholderIndex)
    const transform = extractElementTransform(node, matrix, placeholderSources)
    const shapeProperties = mergeShapeProperties(
      child(node, 'p:spPr'),
      placeholderSources.map((source) => child(source, 'p:spPr')),
    )
    const style = child(node, 'p:style') ?? firstDefined(
      placeholderSources.map((source) => child(source, 'p:style')),
    )
    const text = extractText(
      child(node, 'p:txBody'),
      placeholderSources.map((source) => child(source, 'p:txBody')),
    )
    const preset = child(shapeProperties, 'a:prstGeom')?.attributes?.prst
    const relationshipIds = Array.from(new Set(collectRelationshipIds(node)))

    elements.push({
      path: `${pathLabel}#${node.tag}[${elements.length + 1}]`,
      zIndex: elements.length,
      tag: node.tag,
      kind:
        node.tag === 'p:cxnSp'
          ? 'connector'
          : node.tag === 'p:graphicFrame' || node.tag === 'p:pic'
            ? 'graphicFrame'
            : 'shape',
      nonVisual,
      transform,
      presetGeometry: preset
        ? {
            preset,
            xmlAst: child(shapeProperties, 'a:prstGeom'),
          }
        : undefined,
      relationshipIds,
      xmlAst: node,
      text,
      shapeProperties,
      style,
    })
  }

  return elements
}

function extractTableElements(
  node: XmlNode,
  matrix: TransformMatrix,
  pathLabel: string,
  baseIndex: number,
): ExtractedElementRecord[] {
  const table = findDescendant(node, 'a:tbl')
  if (!table) {
    return []
  }

  const nonVisual = extractNonVisual(node)
  const frame = extractElementTransform(node, matrix)
  const rows = children(table, 'a:tr')
  const gridColumns = children(child(table, 'a:tblGrid'), 'a:gridCol')
  const columnCount = Math.max(
    gridColumns.length,
    ...rows.map((row) => children(row, 'a:tc').reduce((sum, cell) => sum + positiveInt(cell.attributes?.gridSpan, 1), 0)),
    1,
  )
  const columnWidths = resolveTablePartSizes(
    gridColumns.map((column) => Number(column.attributes?.w) || 0),
    columnCount,
    frame.widthPx,
  )
  const rowHeights = resolveTablePartSizes(
    rows.map((row) => Number(row.attributes?.h) || 0),
    Math.max(rows.length, 1),
    frame.heightPx,
    tableAutoRowWeights(rows, columnWidths),
  )
  const totalColumnWidth = positiveNumber(sum(columnWidths), 1)
  const totalRowHeight = positiveNumber(sum(rowHeights), 1)
  const elements: ExtractedElementRecord[] = []
  const fallbackLine = tableDefaultLine(table)

  rows.forEach((row, rowIndex) => {
    let columnIndex = 0

    for (const cell of children(row, 'a:tc')) {
      const gridSpan = Math.min(positiveInt(cell.attributes?.gridSpan, 1), columnCount - columnIndex)
      const rowSpan = Math.min(positiveInt(cell.attributes?.rowSpan, 1), rows.length - rowIndex)

      if (cell.attributes?.hMerge === '1' || cell.attributes?.vMerge === '1') {
        columnIndex += gridSpan
        continue
      }

      const cellWidth = (frame.widthPx * sum(columnWidths.slice(columnIndex, columnIndex + gridSpan))) / totalColumnWidth
      const cellHeight = (frame.heightPx * sum(rowHeights.slice(rowIndex, rowIndex + rowSpan))) / totalRowHeight
      const cellX = frame.xPx + (frame.widthPx * sum(columnWidths.slice(0, columnIndex))) / totalColumnWidth
      const cellY = frame.yPx + (frame.heightPx * sum(rowHeights.slice(0, rowIndex))) / totalRowHeight
      const idBase = nonVisual.id ? nonVisual.id * 1000 : (baseIndex + 1) * 1000

      elements.push({
        path: `${pathLabel}#table[${baseIndex + 1}].row[${rowIndex + 1}].cell[${columnIndex + 1}]`,
        zIndex: baseIndex + elements.length / 1000,
        tag: 'a:tc',
        kind: 'shape',
        nonVisual: {
          id: idBase + rowIndex * 100 + columnIndex + 1,
          name: `${nonVisual.name || 'Table'} Cell ${rowIndex + 1}-${columnIndex + 1}`,
          hidden: nonVisual.hidden,
        },
        transform: {
          xPx: round(cellX),
          yPx: round(cellY),
          widthPx: round(cellWidth),
          heightPx: round(cellHeight),
          rotation: frame.rotation,
          xInches: round(cellX / PX_PER_INCH, 4),
          yInches: round(cellY / PX_PER_INCH, 4),
          widthInches: round(cellWidth / PX_PER_INCH, 4),
          heightInches: round(cellHeight / PX_PER_INCH, 4),
        },
        presetGeometry: {
          preset: 'rect',
        },
        relationshipIds: [],
        xmlAst: cell,
        text: extractText(child(cell, 'a:txBody')),
        shapeProperties: tableCellShapeProperties(cell, fallbackLine),
        style: tableCellTextStyle(cell),
      })

      columnIndex += gridSpan
    }
  })

  return elements
}

function extractNonVisual(node: XmlNode) {
  const nonVisualNode =
    child(node, 'p:nvSpPr') ??
    child(node, 'p:nvCxnSpPr') ??
    child(node, 'p:nvPicPr') ??
    child(node, 'p:nvGraphicFramePr')
  const cNvPr = child(nonVisualNode, 'p:cNvPr')
  const cNvSpPr = child(nonVisualNode, 'p:cNvSpPr')
  const placeholder = findDescendant(nonVisualNode, 'p:ph')
  return {
    id: Number(cNvPr?.attributes?.id) || undefined,
    name: cNvPr?.attributes?.name,
    description: cNvPr?.attributes?.descr || cNvPr?.attributes?.title,
    hidden: cNvPr?.attributes?.hidden === '1',
    isTextBox: cNvSpPr?.attributes?.txBox === '1',
    placeholder: placeholder
      ? {
          type: placeholder.attributes?.type,
          idx: placeholder.attributes?.idx,
        }
      : undefined,
  }
}

function extractElementTransform(
  node: XmlNode,
  matrix: TransformMatrix,
  placeholderSources: XmlNode[] = [],
) {
  const xfrm =
    node.tag === 'p:graphicFrame'
      ? child(node, 'p:xfrm')
      : findTransformNode(child(node, 'p:spPr')) ?? firstDefined(
          placeholderSources.map((source) => findTransformNode(child(source, 'p:spPr'))),
        )
  const off = child(xfrm, 'a:off')?.attributes ?? {}
  const ext = child(xfrm, 'a:ext')?.attributes ?? {}
  const rawX = Number(off.x) || 0
  const rawY = Number(off.y) || 0
  const rawW = Number(ext.cx) || 0
  const rawH = Number(ext.cy) || 0
  const transformedCenter = transformPoint(matrix, rawX + rawW / 2, rawY + rawH / 2)
  const matrixScaleX = Math.hypot(matrix.a, matrix.b)
  const matrixScaleY = Math.hypot(matrix.c, matrix.d)
  const w = Math.abs(matrixScaleX * rawW)
  const h = Math.abs(matrixScaleY * rawH)
  const x = transformedCenter.x - w / 2
  const y = transformedCenter.y - h / 2
  const parentRotation = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  const ownRotation = xfrm?.attributes?.rot ? Number(xfrm.attributes.rot) / 60000 : 0
  const rotation = normalizeDegrees(parentRotation + ownRotation)
  const matrixIsReflected = matrix.a * matrix.d - matrix.b * matrix.c < 0

  return {
    xPx: emuToPx(x),
    yPx: emuToPx(y),
    widthPx: emuToPx(w),
    heightPx: emuToPx(h),
    rotation,
    flipH: xfrm?.attributes?.flipH === '1',
    flipV: (xfrm?.attributes?.flipV === '1') !== matrixIsReflected,
    xInches: round(x / EMU_PER_INCH, 4),
    yInches: round(y / EMU_PER_INCH, 4),
    widthInches: round(w / EMU_PER_INCH, 4),
    heightInches: round(h / EMU_PER_INCH, 4),
  }
}

function groupTransform(node: XmlNode): TransformMatrix {
  const xfrm = findTransformNode(child(node, 'p:grpSpPr'))
  const off = child(xfrm, 'a:off')?.attributes ?? {}
  const ext = child(xfrm, 'a:ext')?.attributes ?? {}
  const chOff = child(xfrm, 'a:chOff')?.attributes ?? {}
  const chExt = child(xfrm, 'a:chExt')?.attributes ?? {}
  const extCx = Number(ext.cx) || 0
  const extCy = Number(ext.cy) || 0
  const chExtCx = Number(chExt.cx) || extCx || 1
  const chExtCy = Number(chExt.cy) || extCy || 1
  const scaleX = extCx ? extCx / chExtCx : 1
  const scaleY = extCy ? extCy / chExtCy : 1
  const offX = Number(off.x) || 0
  const offY = Number(off.y) || 0
  const base = {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: offX - (Number(chOff.x) || 0) * scaleX,
    f: offY - (Number(chOff.y) || 0) * scaleY,
  }
  const centerX = offX + extCx / 2
  const centerY = offY + extCy / 2
  const flip = scaleAround(
    centerX,
    centerY,
    xfrm?.attributes?.flipH === '1' ? -1 : 1,
    xfrm?.attributes?.flipV === '1' ? -1 : 1,
  )
  const rotation = rotateAround(
    centerX,
    centerY,
    xfrm?.attributes?.rot ? Number(xfrm.attributes.rot) / 60000 : 0,
  )

  return multiplyTransform(rotation, multiplyTransform(flip, base))
}

function extractText(textNode: XmlNode | undefined, fallbackTextNodes: Array<XmlNode | undefined> = []) {
  if (!textNode) {
    return undefined
  }

  const fallbackParagraphs = fallbackTextNodes.map((node) => children(node, 'a:p'))
  const paragraphs = children(textNode, 'a:p').map((paragraph, paragraphIndex) => {
    const fallbackParagraph = firstDefined(
      fallbackParagraphs.map((entries) => entries[paragraphIndex] ?? entries[0]),
    )
    const paragraphProperties = child(paragraph, 'a:pPr')
    const fallbackParagraphProperties = child(fallbackParagraph, 'a:pPr')
    const defaultRunProperties = {
      ...extractRunProperties(child(fallbackParagraphProperties, 'a:defRPr')),
      ...extractRunProperties(child(paragraphProperties, 'a:defRPr')),
    }
    const runs = (paragraph.children ?? [])
      .filter((node) => node.tag === 'a:r' || node.tag === 'a:fld' || node.tag === 'a:br')
      .map((run) => ({
        text: run.tag === 'a:br' ? '\n' : child(run, 'a:t')?.text ?? '',
        properties: {
          ...defaultRunProperties,
          ...extractRunProperties(child(run, 'a:rPr')),
        },
      }))
    const bulletPrefix = extractBulletPrefix(paragraphProperties, paragraphIndex)
    if (bulletPrefix) {
      if (runs.length) {
        runs[0].text = `${bulletPrefix}${runs[0].text}`
      } else {
        runs.push({ text: bulletPrefix.trimEnd(), properties: defaultRunProperties })
      }
    }

    return {
      runs,
      properties: {
        ...(fallbackParagraphProperties?.attributes ?? {}),
        ...(paragraphProperties?.attributes ?? {}),
      },
      endParagraphRunProperties: {
        ...(child(fallbackParagraph, 'a:endParaRPr')?.attributes ?? {}),
        ...(child(paragraph, 'a:endParaRPr')?.attributes ?? {}),
      },
    }
  })
  const plainText = paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join('\n')

  return {
    plainText,
    paragraphs,
    bodyProperties: {
      ...firstDefined(fallbackTextNodes.map((node) => child(node, 'a:bodyPr')?.attributes)),
      ...(child(textNode, 'a:bodyPr')?.attributes ?? {}),
    },
  }
}

function extractBulletPrefix(paragraphProperties: XmlNode | undefined, paragraphIndex: number) {
  if (!paragraphProperties || child(paragraphProperties, 'a:buNone')) {
    return ''
  }

  const bullet = child(paragraphProperties, 'a:buChar')
  if (bullet?.attributes?.char) {
    return `${bullet.attributes.char} `
  }

  const automatic = child(paragraphProperties, 'a:buAutoNum')
  if (automatic) {
    const startAt = positiveInt(automatic.attributes?.startAt, 1)
    const value = startAt + paragraphIndex
    const type = automatic.attributes?.type ?? ''
    return type.includes('ParenR') ? `${value}) ` : `${value}. `
  }

  return ''
}

function findPlaceholderSources(
  placeholder: { type?: string; idx?: string } | undefined,
  index: PlaceholderSourceIndex | undefined,
) {
  if (!placeholder || !index) {
    return []
  }

  return [
    findMatchingPlaceholder(index.layout, placeholder),
    findMatchingPlaceholder(index.master, placeholder),
  ].filter((node): node is XmlNode => !!node)
}

function findMatchingPlaceholder(
  candidates: XmlNode[],
  placeholder: { type?: string; idx?: string },
) {
  return candidates.find((candidate) => {
    const candidatePlaceholder = extractNonVisual(candidate).placeholder
    if (!candidatePlaceholder) {
      return false
    }

    if (placeholder.idx && candidatePlaceholder.idx) {
      return placeholder.idx === candidatePlaceholder.idx
    }

    const expectedType = placeholder.type || 'body'
    const candidateType = candidatePlaceholder.type || 'body'
    return expectedType === candidateType
  })
}

function mergeShapeProperties(
  primary: XmlNode | undefined,
  fallbacks: Array<XmlNode | undefined>,
) {
  if (!primary && !fallbacks.some(Boolean)) {
    return undefined
  }

  const merged = cloneNode(primary) ?? { tag: 'p:spPr', children: [] }
  const existingTags = new Set((merged.children ?? []).map((node) => node.tag))

  for (const fallback of fallbacks) {
    for (const fallbackChild of fallback?.children ?? []) {
      if (!existingTags.has(fallbackChild.tag)) {
        const cloned = cloneNode(fallbackChild)
        if (cloned) {
          merged.children?.push(cloned)
          existingTags.add(fallbackChild.tag)
        }
      }
    }
  }

  return merged
}

function firstDefined<T>(values: Array<T | undefined>) {
  return values.find((value): value is T => value !== undefined)
}

function applyExtractedTypography(presentation: NormalizedPresentation, extracted: ExtractedSlideRecord) {
  const theme = extractThemeTypography(extracted.supportParts)
  const sourceByPath = new Map(
    (extracted.shapeTree?.elements ?? [])
      .map((element) => [String(element.path ?? ''), element] as const)
      .filter(([sourcePath]) => !!sourcePath),
  )

  for (const slide of presentation.slides) {
    if (extracted.backgroundColor) {
      slide.backgroundColor = extracted.backgroundColor
    }

    for (const element of slide.elements) {
      if (element.kind === 'line' || element.kind === 'image') {
        continue
      }

      const source = sourceByPath.get(element.sourcePath)
      const extractedRuns = flattenExtractedTextRuns(source?.text)
      const fallbackFontFace = bestFontFace(extractedRuns, theme) || theme.bodyFont || element.fontFace

      if (element.kind === 'text') {
        element.fontFace = fallbackFontFace
        element.runs = applyRunTypography(element.runs, extractedRuns, theme, fallbackFontFace)
        element.color = firstRunColor(element.runs) || element.color
        element.fontSize = firstRunFontSize(element.runs) || element.fontSize
        element.bold = element.runs.length > 0 && element.runs.every((run) => run.bold)
        continue
      }

      element.fontFace = fallbackFontFace
      element.textRuns = applyRunTypography(element.textRuns, extractedRuns, theme, fallbackFontFace)
      element.textColor = firstRunColor(element.textRuns) || element.textColor
      element.fontSize = firstRunFontSize(element.textRuns) || element.fontSize
      element.bold = element.textRuns.length > 0 && element.textRuns.every((run) => run.bold)
    }
  }
}

function applyRunTypography(
  runs: NormalizedTextRun[],
  extractedRuns: ExtractedTextRunRecord[],
  theme: ThemeTypography,
  fallbackFontFace: string,
) {
  if (!runs.length) {
    return runs
  }

  return runs.map((run, index) => {
    const extracted = extractedRuns[index] ?? extractedRuns.find((candidate) => candidate.text === run.text)
    const properties = extracted?.properties ?? {}
    return {
      ...run,
      color: resolveRunColor(properties, theme) || run.color,
      fontFace: resolveRunFontFace(properties, theme) || fallbackFontFace || run.fontFace,
      fontSize: resolveRunFontSize(properties) || run.fontSize,
    }
  })
}

function extractRunProperties(runProperties: XmlNode | undefined) {
  const properties: Record<string, string> = { ...(runProperties?.attributes ?? {}) }
  const typeface = extractRunTypeface(runProperties)
  const color = extractRunColor(runProperties)

  if (typeface) {
    properties.fontFace = typeface
  }

  if (color.value) {
    properties.fontColor = color.value
  }

  if (color.scheme) {
    properties.fontSchemeColor = color.scheme
  }

  return properties
}

function flattenExtractedTextRuns(text: unknown): ExtractedTextRunRecord[] {
  const textBody = text as ExtractedTextBodyRecord | undefined
  return (textBody?.paragraphs ?? []).flatMap((paragraph) => paragraph.runs ?? [])
}

function bestFontFace(runs: ExtractedTextRunRecord[], theme: ThemeTypography) {
  for (const run of runs) {
    const fontFace = resolveRunFontFace(run.properties ?? {}, theme)
    if (fontFace) {
      return fontFace
    }
  }

  return theme.bodyFont
}

function firstRunColor(runs: NormalizedTextRun[]) {
  return runs.find((run) => !!run.color)?.color
}

function firstRunFontSize(runs: NormalizedTextRun[]) {
  return runs.find((run) => run.fontSize > 0)?.fontSize
}

function resolveRunFontFace(properties: Record<string, string>, theme: ThemeTypography) {
  const rawFontFace = properties.fontFace || properties.typeface

  if (!rawFontFace) {
    return theme.bodyFont
  }

  if (rawFontFace === '+mn-lt' || rawFontFace === '+mn-ea' || rawFontFace === '+mn-cs') {
    return theme.bodyFont
  }

  if (rawFontFace === '+mj-lt' || rawFontFace === '+mj-ea' || rawFontFace === '+mj-cs') {
    return theme.headingFont
  }

  return rawFontFace
}

function resolveRunColor(properties: Record<string, string>, theme: ThemeTypography) {
  if (properties.fontColor) {
    return cleanHex(properties.fontColor)
  }

  if (properties.fontSchemeColor) {
    const scheme = mapSchemeColorKey(properties.fontSchemeColor)
    return cleanHex(theme.colors[scheme] || theme.colors[properties.fontSchemeColor] || schemeColorFallback(scheme))
  }

  return undefined
}

function resolveRunFontSize(properties: Record<string, string>) {
  const size = Number(properties.sz)
  return Number.isFinite(size) && size > 0 ? size / 100 : undefined
}

function extractRunTypeface(runProperties: XmlNode | undefined) {
  const latin = child(runProperties, 'a:latin') ?? child(runProperties, 'a:ea') ?? child(runProperties, 'a:cs')
  return latin?.attributes?.typeface
}

function extractRunColor(runProperties: XmlNode | undefined) {
  return extractFillColorValue(child(runProperties, 'a:solidFill'))
}

function extractFillColorValue(fillNode: XmlNode | undefined) {
  const colorNode = cloneColorNode(fillNode)

  if (!colorNode) {
    return {}
  }

  if (colorNode.tag === 'a:srgbClr') {
    return { value: colorNode.attributes?.val }
  }

  if (colorNode.tag === 'a:sysClr') {
    return { value: colorNode.attributes?.lastClr || colorNode.attributes?.val }
  }

  if (colorNode.tag === 'a:schemeClr') {
    return { scheme: colorNode.attributes?.val }
  }

  return {}
}

function extractThemeTypography(supportParts: ExtractedSlideRecord['supportParts']): ThemeTypography {
  const rawXml = supportParts?.['ppt/theme/theme1.xml']?.rawXml
  const fallback = {
    bodyFont: 'Arial',
    headingFont: 'Arial',
    colors: defaultThemeColors(),
  }

  if (!rawXml) {
    return fallback
  }

  return {
    bodyFont: extractThemeFont(rawXml, 'minorFont') || fallback.bodyFont,
    headingFont: extractThemeFont(rawXml, 'majorFont') || fallback.headingFont,
    colors: extractThemeColors(rawXml),
  }
}

function extractThemeFont(rawXml: string, fontKind: 'majorFont' | 'minorFont') {
  const match = rawXml.match(new RegExp(`<a:${fontKind}>[\\s\\S]*?<a:latin[^>]*typeface="([^"]*)"`))
  const typeface = match?.[1]?.trim()
  return typeface || undefined
}

function extractThemeColors(rawXml: string) {
  const colors: Record<string, string> = defaultThemeColors()

  for (const key of Object.keys(colors)) {
    const match = rawXml.match(
      new RegExp(
        `<a:${key}>[\\s\\S]*?(?:<a:srgbClr val="([0-9A-Fa-f]{6})"\\/?>(?:[\\s\\S]*?)<\\/a:srgbClr>|<a:srgbClr val="([0-9A-Fa-f]{6})"\\s*\\/?>|<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"\\s*\\/?>)[\\s\\S]*?<\\/a:${key}>`,
      ),
    )
    const color = match?.[1] || match?.[2] || match?.[3]
    if (color) {
      colors[key] = color.toUpperCase()
    }
  }

  return colors
}

function defaultThemeColors() {
  return {
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
  } satisfies Record<string, string>
}

function mapSchemeColorKey(value: string) {
  const aliases: Record<string, string> = {
    bg1: 'lt1',
    tx1: 'dk1',
    bg2: 'lt2',
    tx2: 'dk2',
  }
  return aliases[value] || value
}

function extractBackgroundColor(root: XmlNode) {
  const background = findDescendant(root, 'p:bg')
  const solidFill = findDescendant(background, 'a:solidFill')
  const color = extractFillColorValue(solidFill)

  if (color.value) {
    return cleanHex(color.value)
  }

  if (color.scheme) {
    return cleanHex(schemeColorFallback(mapSchemeColorKey(color.scheme)))
  }

  const backgroundRef = findDescendant(background, 'p:bgRef')
  const refColor = cloneColorNode(backgroundRef)

  if (refColor?.tag === 'a:srgbClr') {
    return cleanHex(refColor.attributes?.val)
  }

  if (refColor?.tag === 'a:sysClr') {
    return cleanHex(refColor.attributes?.lastClr || refColor.attributes?.val)
  }

  if (refColor?.tag === 'a:schemeClr') {
    return cleanHex(schemeColorFallback(mapSchemeColorKey(refColor.attributes?.val ?? '')))
  }

  return undefined
}

function tableCellShapeProperties(cell: XmlNode, fallbackLine: XmlNode | undefined): XmlNode {
  const tcPr = child(cell, 'a:tcPr')
  const fill = cloneNode(child(tcPr, 'a:solidFill'))
  const line = tableCellLineNode(tcPr) ?? cloneNode(fallbackLine)
  const shapeProperties: XmlNode = {
    tag: 'p:spPr',
    children: [],
  }

  if (fill) {
    shapeProperties.children?.push(fill)
  } else {
    shapeProperties.children?.push({ tag: 'a:noFill', children: [] })
  }

  if (line) {
    shapeProperties.children?.push(line)
  }

  return shapeProperties
}

function tableCellLineNode(tcPr: XmlNode | undefined): XmlNode | undefined {
  const border = ['a:lnB', 'a:lnT', 'a:lnL', 'a:lnR']
    .map((tag) => child(tcPr, tag))
    .find((line) => line && !hasChild(line, 'a:noFill'))
  if (!border) {
    return undefined
  }

  return {
    ...cloneNode(border),
    tag: 'a:ln',
  }
}

function tableDefaultLine(table: XmlNode): XmlNode | undefined {
  const visibleLine = descendants(table, 'a:tcPr')
    .flatMap((tcPr) => ['a:lnB', 'a:lnT', 'a:lnL', 'a:lnR'].map((tag) => child(tcPr, tag)))
    .find((line) => line && !hasChild(line, 'a:noFill'))

  if (!visibleLine) {
    return undefined
  }

  return {
    ...cloneNode(visibleLine),
    tag: 'a:ln',
  }
}

function tableCellTextStyle(cell: XmlNode): XmlNode {
  const txBody = child(cell, 'a:txBody')
  const runColor = descendants(txBody, 'a:rPr')
    .map((runProperties) => cloneColorNode(child(runProperties, 'a:solidFill')))
    .find((colorNode) => !!colorNode)
  const fillColor = tableCellFillColor(child(cell, 'a:tcPr'))
  const fallbackColor = fillColor && isDarkHex(fillColor) ? 'FFFFFF' : '111827'

  return {
    tag: 'p:style',
    children: [
      {
        tag: 'a:fontRef',
        children: [runColor ?? { tag: 'a:srgbClr', attributes: { val: fallbackColor }, children: [] }],
      },
    ],
  }
}

function tableCellFillColor(tcPr: XmlNode | undefined) {
  const colorNode = cloneColorNode(child(tcPr, 'a:solidFill'))
  if (!colorNode) {
    return undefined
  }

  if (colorNode.tag === 'a:srgbClr') {
    return colorNode.attributes?.val
  }

  if (colorNode.tag === 'a:sysClr') {
    return colorNode.attributes?.lastClr || colorNode.attributes?.val
  }

  if (colorNode.tag === 'a:schemeClr') {
    return schemeColorFallback(colorNode.attributes?.val)
  }

  return undefined
}

function cloneColorNode(fillNode: XmlNode | undefined) {
  return cloneNode((fillNode?.children ?? []).find((candidate) => isColorTag(candidate.tag)))
}

function cloneNode(node: XmlNode | undefined): XmlNode | undefined {
  if (!node) {
    return undefined
  }

  return {
    tag: node.tag,
    attributes: node.attributes ? { ...node.attributes } : undefined,
    text: node.text,
    children: node.children?.map((entry) => cloneNode(entry)).filter((entry): entry is XmlNode => !!entry),
  }
}

function isColorTag(tag: string) {
  return tag === 'a:srgbClr' || tag === 'a:sysClr' || tag === 'a:schemeClr'
}

function isDarkHex(value: string) {
  const normalized = value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)
  if (normalized.length !== 6) {
    return false
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return red * 0.299 + green * 0.587 + blue * 0.114 < 145
}

function schemeColorFallback(value: string | undefined) {
  const fallback: Record<string, string> = {
    dk1: '000000',
    dk2: '1F2937',
    bg1: 'FFFFFF',
    bg2: 'F3F4F6',
    lt1: 'FFFFFF',
    lt2: 'F3F4F6',
    tx1: '111827',
    tx2: '374151',
    accent1: '0B075B',
    accent2: 'F97316',
    accent3: '22C55E',
    accent4: 'FACC15',
    accent5: '2563EB',
    accent6: '9333EA',
  }
  return value ? fallback[value] : undefined
}

/**
 * PowerPoint uses `0` for auto-sized table rows. Mixing that zero with explicit
 * EMU heights as a literal `1` makes the explicit row consume almost the entire
 * table. Preserve explicit sizes and distribute the frame's remaining space
 * across auto-sized rows instead.
 */
function resolveTablePartSizes(
  values: number[],
  count: number,
  totalSizePx: number,
  autoWeights: number[] = [],
) {
  const sourceValues = Array.from({ length: count }, (_, index) => values[index] ?? 0)
  const explicitSizes = sourceValues.map((value) => (value > 0 ? (value / EMU_PER_INCH) * PX_PER_INCH : 0))
  const missingIndexes = explicitSizes
    .map((value, index) => (value > 0 ? -1 : index))
    .filter((index) => index >= 0)
  const targetSize = Math.max(totalSizePx, 0)

  if (!missingIndexes.length) {
    return scaleTableParts(explicitSizes, targetSize)
  }

  const explicitTotal = explicitSizes.reduce((total, value) => total + value, 0)
  const remainingSize = targetSize - explicitTotal
  const resolved = [...explicitSizes]

  if (remainingSize > 0) {
    const missingWeightTotal = missingIndexes.reduce(
      (total, index) => total + positiveNumber(autoWeights[index], 1),
      0,
    )
    for (const index of missingIndexes) {
      resolved[index] = (remainingSize * positiveNumber(autoWeights[index], 1)) / missingWeightTotal
    }
    return resolved
  }

  const explicitPerWeight = explicitSizes
    .map((value, index) => value / positiveNumber(autoWeights[index], 1))
    .filter((value) => value > 0)
    .sort((left, right) => left - right)
  const typicalSizePerWeight =
    explicitPerWeight[Math.floor(explicitPerWeight.length / 2)] || targetSize / Math.max(count, 1) || 1

  for (const index of missingIndexes) {
    resolved[index] = typicalSizePerWeight * positiveNumber(autoWeights[index], 1)
  }

  return scaleTableParts(resolved, targetSize)
}

function scaleTableParts(values: number[], totalSizePx: number) {
  const currentTotal = values.reduce((total, value) => total + value, 0)
  if (currentTotal <= 0) {
    return values.map(() => totalSizePx / Math.max(values.length, 1))
  }
  return values.map((value) => (value * totalSizePx) / currentTotal)
}

function tableAutoRowWeights(rows: XmlNode[], columnWidths: number[]) {
  return rows.map((row) => {
    let columnIndex = 0
    let rowWeight = 1

    for (const cell of children(row, 'a:tc')) {
      const gridSpan = Math.min(
        positiveInt(cell.attributes?.gridSpan, 1),
        Math.max(columnWidths.length - columnIndex, 1),
      )
      const cellWidth = columnWidths
        .slice(columnIndex, columnIndex + gridSpan)
        .reduce((total, width) => total + width, 0)

      if (cell.attributes?.hMerge !== '1' && cell.attributes?.vMerge !== '1') {
        const lineCount = estimateTableCellLineCount(cell, cellWidth)
        const rowSpan = positiveInt(cell.attributes?.rowSpan, 1)
        rowWeight = Math.max(rowWeight, (1 + Math.max(lineCount - 1, 0) * 0.5) / rowSpan)
      }

      columnIndex += gridSpan
    }

    return rowWeight
  })
}

function estimateTableCellLineCount(cell: XmlNode, cellWidthPx: number) {
  const textBody = extractText(child(cell, 'a:txBody'))
  const logicalLines = (textBody?.plainText ?? '').split('\n')
  const fontSizePoints = tableCellFontSizePoints(cell)
  const tcPr = child(cell, 'a:tcPr')
  const leftInset = tableCellInsetPx(tcPr?.attributes?.marL)
  const rightInset = tableCellInsetPx(tcPr?.attributes?.marR)
  const availableWidth = Math.max(cellWidthPx - leftInset - rightInset, fontSizePoints)
  const averageCharacterWidth = Math.max(fontSizePoints * (PX_PER_INCH / 72) * 0.46, 1)
  const lineCapacity = Math.max(Math.floor(availableWidth / averageCharacterWidth), 1)

  return Math.max(
    logicalLines.reduce(
      (total, line) => total + Math.max(Math.ceil(Math.max(line.trim().length, 1) / lineCapacity), 1),
      0,
    ),
    1,
  )
}

function tableCellFontSizePoints(cell: XmlNode) {
  const textBody = child(cell, 'a:txBody')
  const sizeNode = [...descendants(textBody, 'a:rPr'), ...descendants(textBody, 'a:defRPr'), ...descendants(textBody, 'a:endParaRPr')]
    .find((node) => Number(node.attributes?.sz) > 0)
  const size = Number(sizeNode?.attributes?.sz)
  return Number.isFinite(size) && size > 0 ? size / 100 : 12
}

function tableCellInsetPx(value: string | undefined) {
  const emu = Number(value)
  return Number.isFinite(emu) && emu >= 0 ? (emu / EMU_PER_INCH) * PX_PER_INCH : PX_PER_INCH * 0.1
}

function positiveNumber(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function coerceNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function cleanHex(value: string | undefined) {
  const normalized = value?.replace(/^#/u, '').trim()
  return /^[0-9A-Fa-f]{6}$/u.test(normalized ?? '') ? normalized!.toUpperCase() : undefined
}

async function collectSupportParts(zip: JSZip, relationships: ExtractedRelationship[]) {
  const supportParts: Record<string, Record<string, unknown>> = {}
  const themeXml = await maybeReadZipText(zip, 'ppt/theme/theme1.xml')

  if (themeXml) {
    supportParts['ppt/theme/theme1.xml'] = {
      path: 'ppt/theme/theme1.xml',
      size: Buffer.byteLength(themeXml),
      relationshipType: 'theme',
      contentTypeHint: 'application/xml',
      rawXml: themeXml,
    }
  }

  for (const relationship of relationships) {
    if (!relationship.resolvedTarget || !relationship.Type?.includes('/image')) {
      continue
    }

    const bytes = await maybeReadZipBytes(zip, relationship.resolvedTarget)
    if (!bytes) {
      continue
    }

    supportParts[relationship.resolvedTarget] = {
      path: relationship.resolvedTarget,
      size: bytes.length,
      relationshipType: relationship.Type,
      contentTypeHint: imageContentType(relationship.resolvedTarget),
      base64: bytes.toString('base64'),
    }
  }

  return supportParts
}

function extractSlidePaths(presentationXml: string, relationships: ExtractedRelationship[]) {
  const presentation = parseXml(presentationXml)
  const relById = new Map(relationships.map((relationship) => [relationship.Id, relationship]))
  return descendants(presentation, 'p:sldId')
    .map((slideId) => relById.get(slideId.attributes?.['r:id'] ?? '')?.resolvedTarget)
    .filter((target): target is string => !!target)
}

function extractSlideSize(presentationXml: string) {
  const presentation = parseXml(presentationXml)
  const sldSz = findDescendant(presentation, 'p:sldSz')
  const cx = Number(sldSz?.attributes?.cx) || 12192000
  const cy = Number(sldSz?.attributes?.cy) || 6858000
  return {
    cx,
    cy,
    widthPx: round((cx / EMU_PER_INCH) * PX_PER_INCH),
    heightPx: round((cy / EMU_PER_INCH) * PX_PER_INCH),
  }
}

function parseRelationships(xml: string, baseDir: string): ExtractedRelationship[] {
  const root = parseXml(xml)
  return descendants(root, 'Relationship').map((relationship) => {
    const Type = relationship.attributes?.Type
    const Target = relationship.attributes?.Target
    return {
      Id: relationship.attributes?.Id ?? '',
      Type,
      Target,
      resolvedTarget: Target ? resolvePartPath(baseDir, Target) : undefined,
      typeShort: Type?.split('/').pop(),
    }
  })
}

function parseXml(xml: string): XmlNode {
  const root: XmlNode = { tag: '#document', children: [] }
  const stack = [root]
  const tokens = xml.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[^>]+>|[^<]+/g) ?? []

  for (const token of tokens) {
    if (token.startsWith('<?') || token.startsWith('<!--') || token.startsWith('<!DOCTYPE')) {
      continue
    }

    if (token.startsWith('</')) {
      stack.pop()
      continue
    }

    if (token.startsWith('<![CDATA[')) {
      appendText(stack.at(-1), token.slice(9, -3))
      continue
    }

    if (token.startsWith('<')) {
      const selfClosing = /\/>\s*$/u.test(token)
      const body = token.slice(1, selfClosing ? -2 : -1).trim()
      const spaceIndex = body.search(/\s/u)
      const tag = spaceIndex === -1 ? body : body.slice(0, spaceIndex)
      const attributes = parseAttributes(spaceIndex === -1 ? '' : body.slice(spaceIndex + 1))
      const node: XmlNode = { tag, attributes, children: [] }
      stack.at(-1)?.children?.push(node)

      if (!selfClosing) {
        stack.push(node)
      }
      continue
    }

    appendText(stack.at(-1), decodeXml(token))
  }

  return root
}

function parseAttributes(input: string) {
  const attributes: Record<string, string> = {}
  const pattern = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu
  let match: RegExpExecArray | null

  while ((match = pattern.exec(input))) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? '')
  }

  return attributes
}

function appendText(node: XmlNode | undefined, text: string) {
  if (!node) {
    return
  }

  const decoded = decodeXml(text)
  if (!decoded) {
    return
  }

  node.text = `${node.text ?? ''}${decoded}`
}

function collectRelationshipIds(node: XmlNode): string[] {
  return [
    ...Object.entries(node.attributes ?? {})
      .filter(([name]) => name === 'r:id' || name === 'r:embed' || name === 'r:link')
      .map(([, value]) => value),
    ...(node.children ?? []).flatMap(collectRelationshipIds),
  ]
}

function paragraphText(textBody: unknown) {
  const body = textBody as { paragraphs?: Array<{ runs?: Array<{ text?: string }> }>; plainText?: string } | undefined
  const lines = (body?.paragraphs ?? [])
    .map((paragraph) => (paragraph.runs ?? []).map((run) => run.text ?? '').join(''))
    .filter((line) => line.trim())
  return lines.length ? lines.join('\n') : body?.plainText?.trim() ?? ''
}

function child(node: XmlNode | undefined, tag: string) {
  return node?.children?.find((candidate) => candidate.tag === tag)
}

function children(node: XmlNode | undefined, tag: string) {
  return node?.children?.filter((candidate) => candidate.tag === tag) ?? []
}

function hasChild(node: XmlNode | undefined, tag: string) {
  return !!child(node, tag)
}

function descendants(node: XmlNode | undefined, tag: string): XmlNode[] {
  if (!node) {
    return []
  }

  return [
    ...(node.tag === tag ? [node] : []),
    ...(node.children ?? []).flatMap((candidate) => descendants(candidate, tag)),
  ]
}

function findDescendant(node: XmlNode | undefined, tag: string) {
  return descendants(node, tag)[0]
}

function findTransformNode(node: XmlNode | undefined) {
  return child(node, 'a:xfrm')
}

function identityTransform(): TransformMatrix {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  }
}

function composeTransform(parent: TransformMatrix, childTransform: TransformMatrix): TransformMatrix {
  return multiplyTransform(parent, childTransform)
}

function multiplyTransform(left: TransformMatrix, right: TransformMatrix): TransformMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

function transformPoint(matrix: TransformMatrix, x: number, y: number) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  }
}

function rotateAround(centerX: number, centerY: number, degrees: number): TransformMatrix {
  if (!degrees) {
    return identityTransform()
  }

  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: centerX - cosine * centerX + sine * centerY,
    f: centerY - sine * centerX - cosine * centerY,
  }
}

function scaleAround(
  centerX: number,
  centerY: number,
  scaleX: number,
  scaleY: number,
): TransformMatrix {
  return {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: centerX * (1 - scaleX),
    f: centerY * (1 - scaleY),
  }
}

function normalizeDegrees(value: number) {
  const normalized = ((value % 360) + 360) % 360
  return Math.abs(normalized) < 0.0001 ? 0 : round(normalized, 4)
}

async function compactPresentation(
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
): Promise<JsonRecord> {
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

function compactShape(element: NormalizedShapeElement): JsonRecord {
  const hasText = !!element.label
  return prune({
    id: element.id,
    type: 'shape',
    shape: element.shape,
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || undefined,
    flipV: element.flipV || undefined,
    opacity: optionalNumber(element.opacity, 1),
    fill: element.fill,
    fillOpacity: optionalNumber(element.fillOpacity ?? 1, 1),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? 1, 1),
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: hasText ? optionalNumber(round(element.padding), 8) : undefined,
    text: element.label || undefined,
    align: hasText && element.align !== 'left' ? element.align : undefined,
    valign: hasText && element.valign !== 'middle' ? element.valign : undefined,
    fontSize: hasText ? round(element.fontSize) : undefined,
    fontFace: hasText ? element.fontFace : undefined,
    bold: hasText && element.bold ? true : undefined,
    textColor: hasText ? element.textColor : undefined,
    runs: compactRuns(element.textRuns, element.label),
  })
}

function compactText(element: NormalizedTextElement): JsonRecord {
  return prune({
    id: element.id,
    type: 'text',
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || undefined,
    flipV: element.flipV || undefined,
    opacity: optionalNumber(element.opacity, 1),
    fill: element.fill,
    fillOpacity: optionalNumber(element.fillOpacity ?? 1, 1),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? 1, 1),
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: optionalNumber(round(element.padding), 8),
    text: element.text || undefined,
    align: element.align === 'left' ? undefined : element.align,
    valign: element.valign === 'middle' ? undefined : element.valign,
    fontSize: round(element.fontSize),
    fontFace: element.fontFace,
    bold: element.bold || undefined,
    italic: element.italic || undefined,
    textColor: element.color,
    runs: compactRuns(element.runs, element.text),
  })
}

function compactLine(element: NormalizedLineElement): JsonRecord {
  return prune({
    id: element.id,
    type: 'line',
    x1: round(element.x1),
    y1: round(element.y1),
    x2: round(element.x2),
    y2: round(element.y2),
    rotate: optionalNumber(element.rotate, 0),
    beginArrow: !element.beginArrow || element.beginArrow === 'none' ? undefined : element.beginArrow,
    opacity: optionalNumber(element.opacity, 1),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? 1, 1),
    strokeWidth: round(element.strokeWidth),
    dash: element.dash === 'solid' ? undefined : element.dash,
    endArrow: element.endArrow === 'none' ? undefined : element.endArrow,
  })
}

async function compactImage(
  element: NormalizedImageElement,
  outputPath: string,
  options: { embedAssets?: boolean },
): Promise<JsonRecord> {
  return prune({
    id: element.id,
    type: 'image',
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || undefined,
    flipV: element.flipV || undefined,
    opacity: optionalNumber(element.opacity, 1),
    src: options.embedAssets ? element.src : await externalizeImage(element.src, outputPath),
    fit: element.fit,
    crop: compactCrop(element.crop),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    altText: element.altText || undefined,
  })
}

function compactRuns(runs: NormalizedTextRun[], text: string) {
  if (!runs.length || (runs.length === 1 && runs[0]?.text === text)) {
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

function compactCrop(crop: NormalizedImageElement['crop']) {
  if (!crop) {
    return undefined
  }

  return prune({
    top: optionalNumber(round(crop.top), 0),
    right: optionalNumber(round(crop.right), 0),
    bottom: optionalNumber(round(crop.bottom), 0),
    left: optionalNumber(round(crop.left), 0),
  })
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

async function readZipText(zip: JSZip, filePath: string) {
  const file = zip.file(filePath)
  if (!file) {
    throw new Error(`Missing expected PowerPoint part: ${filePath}`)
  }
  return file.async('text')
}

async function maybeReadZipText(zip: JSZip, filePath: string) {
  return zip.file(filePath)?.async('text')
}

async function maybeReadZipBytes(zip: JSZip, filePath: string) {
  const bytes = await zip.file(filePath)?.async('nodebuffer')
  return bytes
}

function relationshipPathFor(partPath: string) {
  const directory = path.posix.dirname(partPath)
  const base = path.posix.basename(partPath)
  return path.posix.join(directory, '_rels', `${base}.rels`)
}

function resolvePartPath(baseDir: string, target: string) {
  if (/^[a-z]+:/iu.test(target)) {
    return target
  }
  return path.posix.normalize(path.posix.join(baseDir, target))
}

function imageContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }
  if (extension === '.svg') {
    return 'image/svg+xml'
  }
  if (extension === '.gif') {
    return 'image/gif'
  }
  if (extension === '.emf') {
    return 'image/emf'
  }
  return 'image/png'
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

function optionalNumber(value: number, fallback: number) {
  return value === fallback ? undefined : value
}

function prune(input: JsonRecord) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function emuToPx(value: number) {
  return round((value / EMU_PER_INCH) * PX_PER_INCH)
}

function decodeXml(input: string) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
