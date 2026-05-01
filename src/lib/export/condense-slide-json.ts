import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  normalizePresentationSpec,
  type NormalizedElement,
  type NormalizedImageElement,
  type NormalizedLineElement,
  type NormalizedPresentation,
  type NormalizedShapeElement,
  type NormalizedTextElement,
  type NormalizedTextRun,
} from './pptx.ts'

type JsonRecord = Record<string, unknown>

async function main() {
  const [, , inputArg = 'src/json/file.json', outputArg = 'src/json/file.compact.json'] =
    process.argv
  const inputPath = path.resolve(process.cwd(), inputArg)
  const outputPath = path.resolve(process.cwd(), outputArg)
  const raw = await readFile(inputPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  const { presentation, issues } = normalizePresentationSpec(parsed, {
    baseDir: path.dirname(inputPath),
  })

  const errors = issues.filter((issue) => issue.level === 'error')
  if (!presentation || errors.length > 0) {
    const formattedIssues = issues
      .map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`)
      .join('\n')
    throw new Error(`The JSON could not be condensed.\n${formattedIssues}`)
  }

  const compact = await compactPresentation(presentation, outputPath)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(compact, null, 2)}\n`, 'utf8')

  const beforeBytes = Buffer.byteLength(raw)
  const afterBytes = Buffer.byteLength(JSON.stringify(compact, null, 2)) + 1
  const percent = Math.round((1 - afterBytes / beforeBytes) * 100)
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`)
  console.log(`Condensed ${formatBytes(beforeBytes)} to ${formatBytes(afterBytes)} (${percent}% smaller).`)

  for (const issue of issues.filter((issue) => issue.level === 'warning')) {
    console.warn(`WARNING ${issue.path}: ${issue.message}`)
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

function prune(input: JsonRecord) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function optionalNumber(value: number, fallback: number) {
  return value === fallback ? undefined : value
}

function round(value: number) {
  return Math.round(value * 100) / 100
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
