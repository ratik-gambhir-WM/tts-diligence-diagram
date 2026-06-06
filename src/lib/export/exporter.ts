import {
  buildPptxPresentation,
  buildSuggestedFileName,
  normalizePresentationSpec,
  writePptxPresentation,
  type NormalizationOptions,
  type NormalizedPresentation,
  type PowerPointFileHandle,
  type ValidationIssue,
} from './PowerpointGenerator.ts'

export { buildSuggestedFileName } from './PowerpointGenerator.ts'
export type {
  NormalizationOptions,
  NormalizedPresentation,
  PowerPointFileHandle,
  ValidationIssue,
} from './PowerpointGenerator.ts'

export interface GeneratePowerPointOptions {
  outputPath?: string
  compression?: boolean
  insertAfterSlide?: number
  targetFile?: File
  targetFileHandle?: PowerPointFileHandle
  writeMode?: 'copy' | 'overwrite'
}

export interface GeneratePowerPointFromJsonOptions
  extends NormalizationOptions,
    GeneratePowerPointOptions {}

export interface GeneratePowerPointResult {
  outputPath: string
  fileName: string
  presentation: NormalizedPresentation
  issues: ValidationIssue[]
}

export type GeneratePowerPointFromJsonResult = GeneratePowerPointResult

export async function generatePowerPointFromJson(
  json: unknown,
  options: GeneratePowerPointFromJsonOptions = {},
): Promise<GeneratePowerPointFromJsonResult> {
  const { presentation, issues } = normalizeJsonToPresentation(json, {
    baseDir: options.baseDir,
  })

  return writePowerPoint(presentation, issues, options)
}

export function buildPowerPointFromJson(
  json: unknown,
  options: NormalizationOptions = {},
) {
  const { presentation, issues } = normalizeJsonToPresentation(json, options)

  return {
    pptx: buildPptxPresentation(presentation),
    presentation,
    issues,
  }
}

export function normalizeJsonToPresentation(
  json: unknown,
  options: NormalizationOptions = {},
) {
  const parsed = typeof json === 'string' ? (JSON.parse(json) as unknown) : json
  const { presentation, issues } = normalizePresentationSpec(parsed, options)
  const errors = issues.filter((issue) => issue.level === 'error')

  if (!presentation || errors.length > 0) {
    throw new Error(formatIssues('The JSON could not be converted into a PowerPoint deck.', issues))
  }

  return {
    presentation,
    issues,
  }
}

async function writePowerPoint(
  presentation: NormalizedPresentation,
  issues: ValidationIssue[],
  options: GeneratePowerPointOptions,
): Promise<GeneratePowerPointResult> {
  const fileName = buildSuggestedFileName(presentation)
  const outputPath = options.outputPath ?? fileName

  await writePptxPresentation(presentation, {
    fileName: outputPath,
    compression: options.compression,
    insertAfterSlide: options.insertAfterSlide,
    targetFile: options.targetFile,
    targetFileHandle: options.targetFileHandle,
    writeMode: options.writeMode,
  })

  return {
    outputPath,
    fileName,
    presentation,
    issues,
  }
}

function formatIssues(header: string, issues: ValidationIssue[]) {
  const formattedIssues = issues
    .map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`)
    .join('\n')
  return formattedIssues ? `${header}\n${formattedIssues}` : header
}
