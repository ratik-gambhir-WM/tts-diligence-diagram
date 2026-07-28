const FRAME_IDS = new Set(['element-903000', 'west-monroe-footer', 'west-monroe-logo', 'element-5'])

export function addBrandedSlideFrame(input: unknown): unknown {
  const cloned = typeof structuredClone === 'function' ? structuredClone(input) : JSON.parse(JSON.stringify(input))
  for (const slide of slides(cloned)) {
    const elements = Array.isArray(slide.elements) ? slide.elements.filter(record) : []
    slide.elements = elements.filter((element) => !FRAME_IDS.has(String(element.id ?? '')) && !String(element.id ?? '').startsWith('west-monroe-dot-') && !isFrameImage(element))
  }
  return cloned
}

export const normalizeBrandedSlideFrameImageIds = addBrandedSlideFrame

function isFrameImage(element: Record<string, unknown>) {
  if (!['image', 'picture'].includes(String(element.type ?? element.kind ?? ''))) return false
  return ['src', 'path', 'data'].some((key) => {
    const value = String(element[key] ?? '')
    return value.includes('element-903000.jpg') || value.includes('element-5.png')
  })
}

function slides(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.filter(record)
  if (!record(input)) return []
  if (Array.isArray(input.slides)) return input.slides.filter(record)
  const presentation = record(input.presentation) ? input.presentation : undefined
  return Array.isArray(presentation?.slides) ? presentation.slides.filter(record) : []
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
