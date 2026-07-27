const BRANDED_BACKGROUND_ID = 'element-903000'
const BRANDED_LOGO_ID = 'west-monroe-logo'
const LEGACY_BRANDED_LOGO_ID = 'element-5'
const DEFAULT_SLIDE_WIDTH = 1280
const DEFAULT_SLIDE_HEIGHT = 720
const LOGO_WIDTH = 153
const LOGO_HEIGHT = 32.02
const LOGO_LEFT = 48.33
const LOGO_BOTTOM = 23.9

export function addBrandedSlideFrame(input: unknown): unknown {
  const cloned = cloneJsonLike(input)

  for (const slide of getSlideRecords(cloned)) {
    normalizeBrandedSlideFrameImageIdsInSlide(slide)
    addBrandedSlideFrameToSlide(slide)
  }

  return cloned
}

export function normalizeBrandedSlideFrameImageIds(input: unknown): unknown {
  const cloned = cloneJsonLike(input)

  for (const slide of getSlideRecords(cloned)) {
    normalizeBrandedSlideFrameImageIdsInSlide(slide)
  }

  return cloned
}

function addBrandedSlideFrameToSlide(slide: Record<string, unknown>) {
  const currentElements = Array.isArray(slide.elements) ? slide.elements : []
  const width = asNumber(slide.width, DEFAULT_SLIDE_WIDTH)
  const height = asNumber(slide.height, DEFAULT_SLIDE_HEIGHT)
  const elements = currentElements.filter(isRecord)
  const nextElements: Record<string, unknown>[] = []

  if (!hasFrameImage(elements, BRANDED_BACKGROUND_ID, 'element-903000.jpg')) {
    nextElements.push({
      id: BRANDED_BACKGROUND_ID,
      type: 'image',
      x: 0,
      y: 0,
      w: width,
      h: height,
      src: './assets/element-903000.jpg',
      fit: 'contain',
      altText: 'Layout Background Image',
    })
  }

  if (!hasFrameImage(elements, BRANDED_LOGO_ID, 'element-5.png')) {
    nextElements.push({
      id: BRANDED_LOGO_ID,
      type: 'image',
      x: LOGO_LEFT,
      y: Math.max(0, height - LOGO_HEIGHT - LOGO_BOTTOM),
      w: LOGO_WIDTH,
      h: LOGO_HEIGHT,
      src: './assets/element-5.png',
      fit: 'contain',
      altText: 'West Monroe logo',
    })
  }

  slide.elements = [...nextElements, ...currentElements]
}

function normalizeBrandedSlideFrameImageIdsInSlide(slide: Record<string, unknown>) {
  const elements = Array.isArray(slide.elements) ? slide.elements.filter(isRecord) : []

  for (const element of elements) {
    if (isImageWithFileName(element, 'element-5.png')) {
      element.id = BRANDED_LOGO_ID
    }
  }
}

function getSlideRecords(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input.filter(isRecord)
  }

  if (!isRecord(input)) {
    return []
  }

  if (Array.isArray(input.slides)) {
    return input.slides.filter(isRecord)
  }

  if (isRecord(input.slide)) {
    return [input.slide]
  }

  const presentation = isRecord(input.presentation) ? input.presentation : undefined

  if (Array.isArray(presentation?.slides)) {
    return presentation.slides.filter(isRecord)
  }

  if (isRecord(presentation?.slide)) {
    return [presentation.slide]
  }

  return []
}

function hasFrameImage(elements: Record<string, unknown>[], id: string, fileName: string) {
  return elements.some((element) => {
    if (
      isImageElement(element) &&
      (element.id === id || (id === BRANDED_LOGO_ID && element.id === LEGACY_BRANDED_LOGO_ID))
    ) {
      return true
    }

    return isImageWithFileName(element, fileName)
  })
}

function isImageWithFileName(element: Record<string, unknown>, fileName: string) {
  if (!isImageElement(element)) {
    return false
  }

  const src = typeof element.src === 'string' ? element.src : ''
  const path = typeof element.path === 'string' ? element.path : ''
  const data = typeof element.data === 'string' ? element.data : ''
  return [src, path, data].some((value) => value.includes(fileName))
}

function isImageElement(element: Record<string, unknown>) {
  return element.type === 'image' || element.kind === 'image' || element.type === 'picture'
}

function cloneJsonLike(input: unknown) {
  if (typeof structuredClone === 'function') {
    return structuredClone(input)
  }

  return JSON.parse(JSON.stringify(input)) as unknown
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
