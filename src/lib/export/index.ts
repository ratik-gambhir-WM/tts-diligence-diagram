import {
  buildPptxPresentation,
  buildSuggestedFileName,
  normalizePresentationSpec,
  writePptxPresentation,
  type NormalizationOptions,
  type NormalizedPresentation,
  type ValidationIssue,
} from './pptx.ts'

export { buildSuggestedFileName } from './pptx.ts'
export { isExtractedSlideSpec, normalizeExtractedPresentation } from './PowerpointSimulator.ts'
export type { NormalizationOptions, NormalizedPresentation, ValidationIssue } from './pptx.ts'
export type { ExtractedSlideSpec } from './PowerpointSimulator.ts'

export interface GeneratePowerPointOptions {
  outputPath?: string
  compression?: boolean
}

export interface GeneratePowerPointFromJsonOptions
  extends NormalizationOptions,
    GeneratePowerPointOptions {}

export interface GeneratePowerPointFromPresentationOptions extends GeneratePowerPointOptions {}

export interface GeneratePowerPointResult {
  outputPath: string
  fileName: string
  presentation: NormalizedPresentation
  issues: ValidationIssue[]
}

export type GeneratePowerPointFromJsonResult = GeneratePowerPointResult
export type GeneratePowerPointFromPresentationResult = GeneratePowerPointResult

export async function generatePowerPointFromJson(
  json: unknown,
  options: GeneratePowerPointFromJsonOptions = {},
): Promise<GeneratePowerPointFromJsonResult> {
  const { presentation, issues } = normalizeJsonToPresentation(json, {
    baseDir: options.baseDir,
  })

  return writePowerPoint(presentation, issues, options)
}

export async function generatePowerPointFromPresentation(
  presentation: NormalizedPresentation,
  options: GeneratePowerPointFromPresentationOptions = {},
): Promise<GeneratePowerPointFromPresentationResult> {
  return writePowerPoint(presentation, [], options)
}

export function buildPowerPointFromJson(
  json: unknown,
  options: NormalizationOptions = {},
) {
  const { presentation, issues } = normalizeJsonToPresentation(json, options)
  const built = buildPowerPointFromPresentation(presentation)

  return {
    ...built,
    issues,
  }
}

export function buildPowerPointFromPresentation(presentation: NormalizedPresentation) {
  return {
    pptx: buildPptxPresentation(presentation),
    presentation,
    issues: [] as ValidationIssue[],
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
