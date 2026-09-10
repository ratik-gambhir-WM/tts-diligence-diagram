import { DEFAULT_HEIGHT_PX, DEFAULT_WIDTH_PX } from './CanvasConstants'
import type {
  ExtractedSlideSpec,
  JsonValue,
  NormalizationOptions,
  EditableCanvasPresentation,
  EditableCanvasSlide,
  ValidationIssue,
} from './CanvasTypes'
import { normalizeExtractedPresentation } from './CanvasExtractedNormalizer'
import { normalizeNativePresentation, normalizeNativeSlide } from './CanvasNativeNormalizer'
import { isRecord } from './CanvasUtils'

export function normalizePresentationSpec(
  input: JsonValue | undefined,
  options: NormalizationOptions = {},
): {
  presentation?: EditableCanvasPresentation
  issues: ValidationIssue[]
} {
  const issues: ValidationIssue[] = []

  if (Array.isArray(input)) {
    const slides = input
      .map((entry, index) => normalizeSingleSlideLike(entry, issues, `slides[${index}]`, options))
      .filter((slide): slide is EditableCanvasSlide => slide !== undefined)

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
          preserveElementOrder: false,
          showBranding: true,
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
  input: JsonValue | undefined,
  issues: ValidationIssue[],
  pathLabel: string,
  options: NormalizationOptions,
): EditableCanvasSlide | undefined {
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
