import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import {
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

type JsonRecord = Record<string, unknown>

const EMU_PER_INCH = 914400
const PX_PER_INCH = 96

async function main() {
  const [, , inputArg, outputArg = 'src/json'] = process.argv

  if (!inputArg) {
    throw new Error(
      'Usage: node --experimental-strip-types scripts/extract-pptx-compact-json.ts <deck.pptx> [output-dir]',
    )
  }

  const inputPath = path.resolve(process.cwd(), inputArg)
  const outputDir = path.resolve(process.cwd(), outputArg)
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

  await mkdir(outputDir, { recursive: true })

  const generatedPaths: string[] = []
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

    const stem = uniqueStem(
      `architecture-library-slide-${String(index + 1).padStart(2, '0')}-${slugify(
        presentation.meta.title,
      )}`,
      usedNames,
    )
    const outputPath = path.join(outputDir, `${stem}.compact.json`)
    const compact = await compactPresentation(presentation, outputPath)
    await writeFile(outputPath, `${JSON.stringify(compact, null, 2)}\n`, 'utf8')
    generatedPaths.push(path.relative(process.cwd(), outputPath))
  }

  console.log(`Wrote ${generatedPaths.length} compact JSON files:`)
  for (const generatedPath of generatedPaths) {
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
  slideSize: { cx: number; cy: number; widthPx: number; heightPx: number },
) {
  const slideXml = await readZipText(zip, slidePath)
  const relationshipsPath = relationshipPathFor(slidePath)
  const rawRelationshipsXml = await maybeReadZipText(zip, relationshipsPath)
  const relationships = rawRelationshipsXml
    ? parseRelationships(rawRelationshipsXml, path.posix.dirname(slidePath))
    : []
  const slideAst = parseXml(slideXml)
  const shapeTree = findDescendant(slideAst, 'p:spTree')
  const elements = shapeTree
    ? extractShapeTreeElements(shapeTree, identityTransform(), slidePath)
    : []

  return {
    sourcePptx,
    slideNumber,
    slidePath,
    relationshipsPath,
    relationships,
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
    supportParts: await collectSupportParts(zip, relationships),
    rawXml: slideXml,
    summary: {
      totalDrawableElements: elements.length,
      textElementCount: elements.filter((element) => !!paragraphText(element.text)).length,
    },
  }
}

function extractShapeTreeElements(parent: XmlNode, matrix: TransformMatrix, pathLabel: string) {
  const elements: Array<Record<string, unknown>> = []

  for (const node of parent.children ?? []) {
    if (node.tag === 'p:grpSp') {
      const groupMatrix = composeTransform(matrix, groupTransform(node))
      elements.push(...extractShapeTreeElements(node, groupMatrix, pathLabel))
      continue
    }

    if (!['p:sp', 'p:cxnSp', 'p:pic', 'p:graphicFrame'].includes(node.tag)) {
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

function extractNonVisual(node: XmlNode) {
  const nonVisualNode =
    child(node, 'p:nvSpPr') ??
    child(node, 'p:nvCxnSpPr') ??
    child(node, 'p:nvPicPr') ??
    child(node, 'p:nvGraphicFramePr')
  const cNvPr = child(nonVisualNode, 'p:cNvPr')
  return {
    id: Number(cNvPr?.attributes?.id) || undefined,
    name: cNvPr?.attributes?.name,
    hidden: cNvPr?.attributes?.hidden === '1',
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
        properties: child(run, 'a:rPr')?.attributes ?? {},
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
