import { DEFAULT_HEIGHT_PX, DEFAULT_WIDTH_PX } from './PowerpointConstants.ts'
import type {
  ExtractedSlideSpec,
  NormalizationOptions,
  NormalizedPresentation,
  NormalizedSlide,
  ValidationIssue,
} from './PowerpointTypes.ts'
import { normalizeExtractedPresentation } from './PowerpointExtractedNormalizer.ts'
import { normalizeNativePresentation, normalizeNativeSlide } from './PowerpointNativeNormalizer.ts'
import { isRecord } from './PowerpointUtils.ts'

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
