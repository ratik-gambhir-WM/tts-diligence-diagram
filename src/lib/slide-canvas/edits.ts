import type {
  NormalizedElement,
  NormalizedLineElement,
} from '../export/PowerpointTypes'
import type { SlideElementRef } from './model'
import { buildNormalizedTextRuns, buildRawTextRuns } from './textRuns'

export type ElementEdit = {
  h?: number
  lineType?: NormalizedLineElement['lineType']
  text?: string
  w?: number
  x?: number
  x1?: number
  x2?: number
  y?: number
  y1?: number
  y2?: number
}

export type ElementMutationLocator = Pick<SlideElementRef, 'slideIndex' | 'sourcePath'> & {
  element: Pick<NormalizedElement, 'id' | 'kind'>
}

export function applyElementEditToInput(
  input: unknown,
  locator: ElementMutationLocator,
  edit: ElementEdit,
) {
  const nextInput = cloneJsonValue(input)
  const target = locateRawElement(nextInput, locator)

  if (target) {
    applyRawElementEdit(target, edit)
  }

  return nextInput
}

export function deleteElementsFromInput(
  input: unknown,
  locators: ElementMutationLocator[],
) {
  const nextInput = cloneJsonValue(input)
  const targets = new Set(
    locators
      .map((locator) => locateRawElement(nextInput, locator))
      .filter((target): target is Record<string, unknown> => target !== undefined),
  )

  if (targets.size > 0) {
    deleteRawElementObjects(nextInput, targets)
  }

  return nextInput
}

export function applyElementEdit(element: NormalizedElement, edit: ElementEdit): NormalizedElement {
  if (element.kind === 'line') {
    return {
      ...element,
      lineType: edit.lineType ?? element.lineType,
      x1: edit.x1 ?? element.x1,
      y1: edit.y1 ?? element.y1,
      x2: edit.x2 ?? element.x2,
      y2: edit.y2 ?? element.y2,
    }
  }

  const geometryEdit = {
    ...(edit.h !== undefined ? { h: edit.h } : undefined),
    ...(edit.w !== undefined ? { w: edit.w } : undefined),
    ...(edit.x !== undefined ? { x: edit.x } : undefined),
    ...(edit.y !== undefined ? { y: edit.y } : undefined),
  }

  if (element.kind === 'image') {
    return { ...element, ...geometryEdit }
  }

  if (element.kind === 'text') {
    const text = edit.text ?? element.text
    return {
      ...element,
      ...geometryEdit,
      ...(edit.text !== undefined
        ? { runs: buildNormalizedTextRuns(element, text), text }
        : undefined),
    }
  }

  const text = edit.text ?? element.label
  return {
    ...element,
    ...geometryEdit,
    ...(edit.text !== undefined
      ? { label: text, textRuns: buildNormalizedTextRuns(element, text) }
      : undefined),
  }
}

function locateRawElement(
  input: unknown,
  locator: ElementMutationLocator,
): Record<string, unknown> | undefined {
  const elementIndex = getElementIndex(locator.sourcePath)
  const slide = getRawSlides(input)[locator.slideIndex]
  const sourceCandidate =
    elementIndex !== undefined && Array.isArray(slide?.elements)
      ? slide.elements[elementIndex]
      : undefined

  if (isRecord(sourceCandidate) && rawElementMatches(sourceCandidate, locator)) {
    return sourceCandidate
  }

  const matches: Record<string, unknown>[] = []
  collectMatchingRawElements(input, locator, matches)
  return matches.length === 1 ? matches[0] : undefined
}

function getRawSlides(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    return input.filter(isRecord)
  }

  if (!isRecord(input)) {
    return []
  }

  if (Array.isArray(input.elements)) {
    return [input]
  }

  const presentation = isRecord(input.presentation) ? input.presentation : input
  if (Array.isArray(presentation.slides)) {
    return presentation.slides.filter(isRecord)
  }

  if (isRecord(presentation.slide)) {
    return [presentation.slide]
  }

  if (isRecord(input.slide)) {
    return [input.slide]
  }

  return []
}

function getElementIndex(sourcePath: string) {
  const match = sourcePath.match(/(?:^|\.)elements\[(\d+)](?:$|\.)/)
  if (!match) {
    return undefined
  }

  const value = Number(match[1])
  return Number.isInteger(value) ? value : undefined
}

function rawElementMatches(
  rawElement: Record<string, unknown>,
  locator: ElementMutationLocator,
) {
  return getRawKind(rawElement) === locator.element.kind && getRawIds(rawElement).has(locator.element.id)
}

function getRawIds(rawElement: Record<string, unknown>) {
  const ids = new Set<string>()
  if (typeof rawElement.id === 'string') {
    ids.add(rawElement.id)
  }

  if (isRecord(rawElement.nonVisual)) {
    const nonVisualId = rawElement.nonVisual.id
    if (typeof nonVisualId === 'number' || typeof nonVisualId === 'string') {
      ids.add(`element-${nonVisualId}`)
    }
  }

  return ids
}

function getRawKind(rawElement: Record<string, unknown>): NormalizedElement['kind'] | undefined {
  const rawKind = String(
    rawElement.kind ?? rawElement.type ?? rawElement.elementType ?? rawElement.shape ?? '',
  ).toLowerCase()

  if (rawKind === 'text' || rawKind === 'textbox') {
    return 'text'
  }
  if (rawKind === 'image' || rawKind === 'picture' || rawKind === 'pic') {
    return 'image'
  }
  if (rawKind === 'line' || rawKind === 'connector') {
    return 'line'
  }
  if (rawKind === 'shape' || rawElement.shape !== undefined) {
    return 'shape'
  }

  return undefined
}

function collectMatchingRawElements(
  value: unknown,
  locator: ElementMutationLocator,
  matches: Record<string, unknown>[],
) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMatchingRawElements(item, locator, matches))
    return
  }

  if (!isRecord(value)) {
    return
  }

  if (rawElementMatches(value, locator)) {
    matches.push(value)
  }

  Object.values(value).forEach((item) => collectMatchingRawElements(item, locator, matches))
}

function deleteRawElementObjects(value: unknown, targets: Set<Record<string, unknown>>): boolean {
  if (Array.isArray(value)) {
    let didDelete = false
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const item = value[index]
      if (isRecord(item) && targets.has(item)) {
        value.splice(index, 1)
        didDelete = true
      } else {
        didDelete = deleteRawElementObjects(item, targets) || didDelete
      }
    }
    return didDelete
  }

  if (!isRecord(value)) {
    return false
  }

  return Object.values(value).some((item) => deleteRawElementObjects(item, targets))
}

function applyRawElementEdit(element: Record<string, unknown>, edit: ElementEdit) {
  for (const key of ['x1', 'y1', 'x2', 'y2', 'lineType'] as const) {
    if (edit[key] !== undefined) {
      element[key] = edit[key]
    }
  }

  for (const [key, alias] of [
    ['x', 'left'],
    ['y', 'top'],
    ['w', 'width'],
    ['h', 'height'],
  ] as const) {
    if (edit[key] !== undefined) {
      element[key] = edit[key]
      if (alias in element) {
        element[alias] = edit[key]
      }
    }
  }

  if (edit.text !== undefined) {
    element.text = edit.text
    if ('label' in element) {
      element.label = edit.text
    }
    element.runs = buildRawTextRuns(element, edit.text)
  }
}

function cloneJsonValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)]),
    ) as T
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

