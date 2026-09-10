import { resolveBundledSlideAssetImageSources } from '../canvas-model/assetResolver'
import { getConnectorAwareElementOrder } from '../canvas-model/CanvasLayering'
import { normalizePresentationSpec } from '../canvas-model/CanvasNormalizer'
import type {
  JsonValue,
  EditableCanvasElement,
  EditableCanvasPresentation,
  EditableCanvasSlide,
  ValidationIssue,
} from '../canvas-model/CanvasTypes'

export type SlideElementRef = {
  element: EditableCanvasElement
  key: string
  slideIndex: number
  sourcePath: string
}

export interface SlideCanvasModel {
  elementRefs: SlideElementRef[]
  issues: ValidationIssue[]
  presentation?: EditableCanvasPresentation
  slide?: EditableCanvasSlide
}

export interface BuildSlideCanvasModelOptions {
  resolveAssets?: boolean
  slideIndex?: number
}

export function buildSlideCanvasModel(
  input: JsonValue,
  options: BuildSlideCanvasModelOptions = {},
): SlideCanvasModel {
  const slideIndex = options.slideIndex ?? 0
  const normalizedInput = options.resolveAssets === false
    ? input
    : resolveBundledSlideAssetImageSources(input)
  const { presentation, issues } = normalizePresentationSpec(normalizedInput)
  const slide = presentation?.slides[slideIndex]

  if (!slide) {
    return {
      elementRefs: [],
      issues,
      presentation,
    }
  }

  const keyCounts = new Map<string, number>()
  const orderedElements = slide.preserveElementOrder
    ? slide.elements
    : getConnectorAwareElementOrder(slide)
  const elementRefs = orderedElements.map((element) => {
    const baseKey = `${slideIndex}:${element.sourcePath}`
    const occurrence = keyCounts.get(baseKey) ?? 0
    keyCounts.set(baseKey, occurrence + 1)

    return {
      element,
      key: occurrence === 0 ? baseKey : `${baseKey}:${occurrence}`,
      slideIndex,
      sourcePath: element.sourcePath,
    }
  })

  return {
    elementRefs,
    issues,
    presentation,
    slide,
  }
}
