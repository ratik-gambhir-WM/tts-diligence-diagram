import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import {
  buildThemedPptxBytes,
  normalizePresentationSpec,
  type NormalizedElement,
  type NormalizedImageElement,
  type NormalizedLineElement,
  type NormalizedPresentation,
  type NormalizedShapeElement,
  type NormalizedTextElement,
  type NormalizedTextRun,
} from '../src/pptx.ts'

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
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
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

type JsonRecord = Record<string, unknown>

const EMU_PER_INCH = 914400
const PX_PER_INCH = 96
const DEFAULT_OUTPUT_DIR = 'src/commentary-tempaltes'

async function main() {
  const [, , inputArg, pptxOutputArg] = process.argv

  if (!inputArg) {
    throw new Error(
      'Usage: node --experimental-strip-types scripts/parse-pptx.ts <deck.pptx> [pptx-output-path-or-dir]',
    )
  }

  const inputPath = path.resolve(process.cwd(), inputArg)
  const outputDir = path.resolve(process.cwd(), DEFAULT_OUTPUT_DIR)
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

  if (pptxOutputArg && path.extname(pptxOutputArg).toLowerCase() === '.pptx' && slidePaths.length > 1) {
    throw new Error(
      'A single .pptx output path can only be used when the source deck has one slide. Use an output directory for multi-slide decks.',
    )
  }

  await mkdir(outputDir, { recursive: true })

  const generatedJsonPaths: string[] = []
  const generatedPptxPaths: string[] = []
  const warnings: string[] = []
  const usedNames = new Set<string>()

  for (const [index, slidePath] of slidePaths.entries()) {
    const extracted = await extractSlide(zip, inputPath, slidePath, index + 1, slideSize)
    const { presentation, issues } = normalizePresentationSpec(extracted, {
      baseDir: outputDir,
    })
    const errors = issues.filter((issue) => issue.level === 'error')

    if (!presentation || errors.length) {
      const formatted = issues
        .map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`)
        .join('\n')
      throw new Error(`Slide ${index + 1} could not be normalized.\n${formatted}`)
    }

    warnings.push(
      ...issues
        .filter((issue) => issue.level === 'warning')
        .map((issue) => `slide ${index + 1}: ${issue.path}: ${issue.message}`),
    )

    applyExtractedTypography(presentation, extracted)

    const stem = uniqueStem(
      `slide-${String(index + 1).padStart(2, '0')}-${presentation.meta.title}`,
      usedNames,
    )
    const outputPath = path.join(outputDir, `${stem}.compact.json`)
    const compact = await compactPresentation(presentation, outputPath)
    await writeFile(outputPath, `${JSON.stringify(compact, null, 2)}\n`, 'utf8')
    generatedJsonPaths.push(path.relative(process.cwd(), outputPath))

    const {
      presentation: generatedPresentation,
      issues: generatedIssues,
    } = normalizePresentationSpec(compact, {
      baseDir: path.dirname(outputPath),
    })
    const generatedErrors = generatedIssues.filter((issue) => issue.level === 'error')

    if (!generatedPresentation || generatedErrors.length) {
      const formatted = generatedIssues
        .map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`)
        .join('\n')
      throw new Error(`Slide ${index + 1} could not be converted into a PowerPoint deck.\n${formatted}`)
    }

    warnings.push(
      ...generatedIssues
        .filter((issue) => issue.level === 'warning')
        .map((issue) => `generated slide ${index + 1}: ${issue.path}: ${issue.message}`),
    )

    const pptxOutputPath = resolvePptxOutputPath(outputDir, pptxOutputArg, stem)
    await mkdir(path.dirname(pptxOutputPath), { recursive: true })
    await writeFile(pptxOutputPath, await buildThemedPptxBytes(generatedPresentation))
    generatedPptxPaths.push(path.relative(process.cwd(), pptxOutputPath))
  }

  console.log(`Wrote ${generatedJsonPaths.length} compact JSON files:`)
  for (const generatedPath of generatedJsonPaths) {
    console.log(`- ${generatedPath}`)
  }

  console.log(`Wrote ${generatedPptxPaths.length} PowerPoint files:`)
  for (const generatedPath of generatedPptxPaths) {
    console.log(`- ${generatedPath}`)
  }

  for (const warning of warnings) {
    console.warn(`WARNING ${warning}`)
  }
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
  const slideBackgroundElement = extractBackgroundImageElement(
    slideAst,
    slidePath,
    'Slide',
    -2500,
    slideSize,
  )
  const shapeTree = findDescendant(slideAst, 'p:spTree')
  const slideElements = shapeTree
    ? extractShapeTreeElements(shapeTree, identityTransform(), slidePath)
    : []
  const baseElements = [
    ...inherited.elements,
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
    elements: [...master.elements, ...layout.elements],
    relationships: [...master.relationships, ...layout.relationships],
    backgroundColor: layout.backgroundColor || master.backgroundColor,
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

function extractShapeTreeElements(parent: XmlNode, matrix: TransformMatrix, pathLabel: string) {
  const elements: ExtractedElementRecord[] = []

  for (const node of parent.children ?? []) {
    if (node.tag === 'p:grpSp') {
      const groupMatrix = composeTransform(matrix, groupTransform(node))
      elements.push(...extractShapeTreeElements(node, groupMatrix, pathLabel))
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
    const transform = extractElementTransform(node, matrix)
    const shapeProperties = child(node, 'p:spPr')
    const style = child(node, 'p:style')
    const text = extractText(child(node, 'p:txBody'))
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
  const columnWidths = normalizedParts(
    gridColumns.map((column) => Number(column.attributes?.w) || 0),
    columnCount,
  )
  const rowHeights = normalizedParts(
    rows.map((row) => Number(row.attributes?.h) || 0),
    Math.max(rows.length, 1),
  )
  const totalColumnWidth = sum(columnWidths)
  const totalRowHeight = sum(rowHeights)
  const elements: ExtractedElementRecord[] = []
  const fallbackLine = tableDefaultLine(table)

  rows.forEach((row, rowIndex) => {
    let columnIndex = 0

    for (const cell of children(row, 'a:tc')) {
      const gridSpan = positiveInt(cell.attributes?.gridSpan, 1)
      const rowSpan = positiveInt(cell.attributes?.rowSpan, 1)

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
  const placeholder = findDescendant(nonVisualNode, 'p:ph')
  return {
    id: Number(cNvPr?.attributes?.id) || undefined,
    name: cNvPr?.attributes?.name,
    hidden: cNvPr?.attributes?.hidden === '1',
    placeholder: placeholder
      ? {
          type: placeholder.attributes?.type,
          idx: placeholder.attributes?.idx,
        }
      : undefined,
  }
}

function extractElementTransform(node: XmlNode, matrix: TransformMatrix) {
  const xfrm =
    node.tag === 'p:graphicFrame'
      ? child(node, 'p:xfrm')
      : findTransformNode(child(node, 'p:spPr'))
  const off = child(xfrm, 'a:off')?.attributes ?? {}
  const ext = child(xfrm, 'a:ext')?.attributes ?? {}
  const rawX = Number(off.x) || 0
  const rawY = Number(off.y) || 0
  const rawW = Number(ext.cx) || 0
  const rawH = Number(ext.cy) || 0
  const x = matrix.scaleX * rawX + matrix.translateX
  const y = matrix.scaleY * rawY + matrix.translateY
  const w = matrix.scaleX * rawW
  const h = matrix.scaleY * rawH
  const rotation = xfrm?.attributes?.rot ? Number(xfrm.attributes.rot) / 60000 : null

  return {
    xPx: emuToPx(x),
    yPx: emuToPx(y),
    widthPx: emuToPx(w),
    heightPx: emuToPx(h),
    rotation,
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
  const translateX = (Number(off.x) || 0) - (Number(chOff.x) || 0) * scaleX
  const translateY = (Number(off.y) || 0) - (Number(chOff.y) || 0) * scaleY

  return { scaleX, scaleY, translateX, translateY }
}

function extractText(textNode: XmlNode | undefined) {
  if (!textNode) {
    return undefined
  }

  const paragraphs = children(textNode, 'a:p').map((paragraph) => {
    const runs = (paragraph.children ?? [])
      .filter((node) => node.tag === 'a:r' || node.tag === 'a:fld')
      .map((run) => ({
        text: child(run, 'a:t')?.text ?? '',
        properties: extractRunProperties(child(run, 'a:rPr')),
      }))

    return {
      runs,
      properties: child(paragraph, 'a:pPr')?.attributes ?? {},
      endParagraphRunProperties: child(paragraph, 'a:endParaRPr')?.attributes ?? {},
    }
  })
  const plainText = paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .filter((line) => line.trim())
    .join('\n')

  return {
    plainText,
    paragraphs,
    bodyProperties: child(textNode, 'a:bodyPr')?.attributes ?? {},
  }
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
        element.bold = element.runs.some((run) => run.bold)
        continue
      }

      element.fontFace = fallbackFontFace
      element.textRuns = applyRunTypography(element.textRuns, extractedRuns, theme, fallbackFontFace)
      element.textColor = firstRunColor(element.textRuns) || element.textColor
      element.fontSize = firstRunFontSize(element.textRuns) || element.fontSize
      element.bold = element.textRuns.some((run) => run.bold)
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

function normalizedParts(values: number[], count: number) {
  if (values.length >= count && values.every((value) => value > 0)) {
    return values.slice(0, count)
  }

  const positiveValues = values.slice(0, count).map((value) => (value > 0 ? value : 1))
  while (positiveValues.length < count) {
    positiveValues.push(1)
  }
  return positiveValues
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0) || 1
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
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
  }
}

function composeTransform(parent: TransformMatrix, childTransform: TransformMatrix): TransformMatrix {
  return {
    scaleX: parent.scaleX * childTransform.scaleX,
    scaleY: parent.scaleY * childTransform.scaleY,
    translateX: parent.scaleX * childTransform.translateX + parent.translateX,
    translateY: parent.scaleY * childTransform.translateY + parent.translateY,
  }
}

async function compactPresentation(presentation: NormalizedPresentation, outputPath: string) {
  return {
    presentation: {
      title: presentation.meta.title,
      slides: await Promise.all(
        presentation.slides.map(async (slide) => ({
          id: slide.id,
          name: slide.name,
          width: round(slide.width),
          height: round(slide.height),
          backgroundColor: slide.backgroundColor,
          elements: await Promise.all(
            slide.elements.map((element, index) => compactElement(element, outputPath, index)),
          ),
        })),
      ),
    },
  }
}

async function compactElement(
  element: NormalizedElement,
  outputPath: string,
  index: number,
): Promise<JsonRecord> {
  if (element.kind === 'line') {
    return compactLine(element)
  }

  if (element.kind === 'image') {
    return compactImage(element, outputPath, index)
  }

  if (element.kind === 'text') {
    return compactText(element)
  }

  return compactShape(element)
}

function compactShape(element: NormalizedShapeElement): JsonRecord {
  return prune({
    id: element.id,
    type: 'shape',
    shape: element.shape,
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    opacity: optionalNumber(element.opacity, 1),
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: optionalNumber(round(element.padding), 8),
    text: element.label || undefined,
    align: element.align,
    valign: element.valign,
    fontSize: round(element.fontSize),
    fontFace: element.fontFace,
    bold: element.bold || undefined,
    textColor: element.textColor,
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
    opacity: optionalNumber(element.opacity, 1),
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: optionalNumber(round(element.padding), 8),
    text: element.text || undefined,
    align: element.align,
    valign: element.valign,
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
    opacity: optionalNumber(element.opacity, 1),
    stroke: element.stroke,
    strokeWidth: round(element.strokeWidth),
    dash: element.dash === 'solid' ? undefined : element.dash,
    endArrow: element.endArrow === 'none' ? undefined : element.endArrow,
  })
}

async function compactImage(
  element: NormalizedImageElement,
  outputPath: string,
  index: number,
): Promise<JsonRecord> {
  return prune({
    id: element.id,
    type: 'image',
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    opacity: optionalNumber(element.opacity, 1),
    src: await externalizeImage(element.src, outputPath, element.id || `image-${index + 1}`),
    fit: element.fit,
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    altText: element.altText || undefined,
  })
}

function compactRuns(runs: NormalizedTextRun[], text: string) {
  if (runs.length <= 1 && runs[0]?.text === text && !runs[0]?.breakLine) {
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

async function externalizeImage(src: string, outputPath: string, id: string) {
  const dataUri = /^data:([^;,]+);base64,(.+)$/u.exec(src)
  if (!dataUri) {
    return src
  }

  const [, mimeType, base64] = dataUri
  const extension = mimeTypeToExtension(mimeType)
  const fileName = `${slugify(id) || 'image'}${extension}`
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueStem(stem: string, usedNames: Set<string>) {
  const base = slugify(stem) || 'slide'
  let candidate = base
  let suffix = 2

  while (usedNames.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  usedNames.add(candidate)
  return candidate
}

function resolvePptxOutputPath(outputDir: string, outputArg: string | undefined, stem: string) {
  if (!outputArg) {
    return path.join(outputDir, `${stem}.pptx`)
  }

  const resolved = path.resolve(process.cwd(), outputArg)
  if (path.extname(resolved).toLowerCase() === '.pptx') {
    return resolved
  }

  return path.join(resolved, `${stem}.pptx`)
}

function decodeXml(input: string) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
