import type { JsonObject, JsonValue } from '../canvas-model/CanvasTypes'

const FRAME_IDS = new Set(['element-903000', 'west-monroe-footer', 'west-monroe-logo'])

export function removeLegacyBrandedFrame<TInput extends JsonValue>(input: TInput): TInput {
  const cloned = typeof structuredClone === 'function'
    ? structuredClone(input)
    : JSON.parse(JSON.stringify(input)) as TInput
  for (const slide of slides(cloned)) {
    const elements = Array.isArray(slide.elements) ? slide.elements.filter(record) : []
    slide.elements = elements.filter((element) => !isBrandedFrameElement(element))
  }
  return cloned
}

export const normalizeBrandedSlideFrameImageIds = removeLegacyBrandedFrame

function isBrandedFrameElement(element: JsonObject) {
  const id = String(element.id ?? '')
  if (FRAME_IDS.has(id) || id.startsWith('west-monroe-dot-')) return true
  if (!['image', 'picture'].includes(String(element.type ?? element.kind ?? ''))) return false
  return ['src', 'path', 'data'].some((key) => {
    const value = String(element[key] ?? '')
    return value.includes('element-903000.jpg') || value.includes('element-5.png')
  })
}

function slides(input: JsonValue): JsonObject[] {
  if (Array.isArray(input)) return input.filter(record)
  if (!record(input)) return []
  if (Array.isArray(input.slides)) return input.slides.filter(record)
  const presentation = record(input.presentation) ? input.presentation : undefined
  return Array.isArray(presentation?.slides) ? presentation.slides.filter(record) : []
}

function record(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
