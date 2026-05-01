import {
  buildPptxPresentation,
  buildSuggestedFileName,
  normalizePresentationSpec,
  type NormalizationOptions,
  type NormalizedPresentation,
  type ValidationIssue,
} from './pptx.ts'

export interface GeneratePowerPointFromJsonOptions extends NormalizationOptions {
  outputPath?: string
  compression?: boolean
}

export interface GeneratePowerPointFromJsonResult {
  outputPath: string
  fileName: string
  presentation: NormalizedPresentation
  issues: ValidationIssue[]
}

export async function generatePowerPointFromJson(
  json: unknown,
  options: GeneratePowerPointFromJsonOptions = {},
): Promise<GeneratePowerPointFromJsonResult> {
  const parsed = typeof json === 'string' ? (JSON.parse(json) as unknown) : json
  const { presentation, issues } = normalizePresentationSpec(parsed, {
    baseDir: options.baseDir,
  })
  const errors = issues.filter((issue) => issue.level === 'error')

  if (!presentation || errors.length > 0) {
    throw new Error(formatIssues('The JSON could not be converted into a PowerPoint deck.', issues))
  }

  const fileName = buildSuggestedFileName(presentation)
  const outputPath = options.outputPath ?? fileName
  const pptx = buildPptxPresentation(presentation)

  await pptx.writeFile({
    fileName: outputPath,
    compression: options.compression ?? true,
  })

  return {
    outputPath,
    fileName,
    presentation,
    issues,
  }
}

export function buildPowerPointFromJson(
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
    pptx: buildPptxPresentation(presentation),
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
