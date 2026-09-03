import PptxGenJS from 'pptxgenjs'
import {
  getWestMonroeBrandFrameLayout,
  WEST_MONROE_BRAND_COLOR,
} from '../WestMonroeBrandFrame'
import { DEFAULT_FONT_FACE, DEFAULT_OPACITY } from '../shared/PowerpointConstants'
import type {
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedShapeElement,
  NormalizedTextElement,
  NormalizedTextRun,
} from '../shared/PowerpointTypes'
import { cleanHex } from '../shared/PowerpointUtils'
import {
  PPTX_AVERAGE_GLYPH_WIDTH_FACTOR,
  PPTX_DEFAULT_BACKGROUND_COLOR,
  PPTX_DEFAULT_FONT_SIZE_PT,
  PPTX_DEFAULT_LINE_COLOR,
  PPTX_DEFAULT_TEXT_COLOR,
  PPTX_FULL_TRANSPARENCY,
  PPTX_LINE_SPACING_MULTIPLE,
  PPTX_MIN_DIMENSION_PX,
  PPTX_MIN_FONT_SIZE_PT,
  PPTX_MIN_VISIBLE_CROP_FRACTION,
  PPTX_STACKED_LINE_HEIGHT_MULTIPLE,
  PPTX_TEXT_SHRINK_FACTOR,
} from './PowerpointConstants'
import {
  opacityToTransparency,
  pxToInches,
  toPptxShapeName,
  toPptxVerticalAlign,
} from './PowerpointUtils'
import { getConnectorAwareElementOrder } from '../shared/PowerpointLayering'

const WEST_MONROE_LOGO_IMAGE_PATH = new URL('../../slide-assets/element-5.png', import.meta.url).pathname

export function buildPptxPresentation(presentation: NormalizedPresentation) {
  const pptx = new PptxGenJS()
  const widthInches = pxToInches(presentation.meta.width)
  const heightInches = pxToInches(presentation.meta.height)
  const brandFrame = getWestMonroeBrandFrameLayout(
    presentation.meta.width,
    presentation.meta.height,
  )

  pptx.defineLayout({
    name: 'JSON_LAYOUT',
    width: widthInches,
    height: heightInches,
  })
  pptx.layout = 'JSON_LAYOUT'
  pptx.author = 'OpenAI Codex'
  pptx.company = 'OpenAI'
  pptx.subject = 'JSON to PowerPoint'
  pptx.title = presentation.meta.title
  pptx.theme = {
    headFontFace: DEFAULT_FONT_FACE,
    bodyFontFace: DEFAULT_FONT_FACE,
  }
  if (presentation.meta.showBranding) {
    pptx.defineSlideMaster({
      title: 'WEST_MONROE_BRANDED_FRAME',
      objects: [
        {
          rect: {
            x: pxToInches(brandFrame.footer.x),
            y: pxToInches(brandFrame.footer.y),
            w: pxToInches(brandFrame.footer.w),
            h: pxToInches(brandFrame.footer.h),
            fill: { color: WEST_MONROE_BRAND_COLOR },
            line: { transparency: PPTX_FULL_TRANSPARENCY },
          },
        },
        ...brandFrame.dots.map((dot) => ({
          rect: {
            x: pxToInches(dot.x),
            y: pxToInches(dot.y),
            w: pxToInches(dot.w),
            h: pxToInches(dot.h),
            fill: { color: WEST_MONROE_BRAND_COLOR },
            line: { transparency: PPTX_FULL_TRANSPARENCY },
          },
        })),
        {
          image: {
            path: WEST_MONROE_LOGO_IMAGE_PATH,
            x: pxToInches(brandFrame.logo.x),
            y: pxToInches(brandFrame.logo.y),
            w: pxToInches(brandFrame.logo.w),
            h: pxToInches(brandFrame.logo.h),
          },
        },
      ],
    })
  }
  for (const slideSpec of presentation.slides) {
    const slide = presentation.meta.showBranding
      ? pptx.addSlide('WEST_MONROE_BRANDED_FRAME')
      : pptx.addSlide()
    slide.background = { color: cleanHex(slideSpec.backgroundColor, PPTX_DEFAULT_BACKGROUND_COLOR) }

    const elements = slideSpec.preserveElementOrder
      ? slideSpec.elements
      : getConnectorAwareElementOrder(slideSpec)
    for (const element of elements) {
      if (element.kind === 'line') {
        for (const segment of toPptxLineSegments(element)) {
          const lineGeometry = toPptxLineGeometry(segment)
          slide.addShape('line', {
            x: pxToInches(lineGeometry.x),
            y: pxToInches(lineGeometry.y),
            w: pxToInches(lineGeometry.w),
            h: pxToInches(lineGeometry.h),
            flipH: lineGeometry.flipH,
            flipV: lineGeometry.flipV,
            rotate: element.rotate,
            line: {
              color: cleanHex(element.stroke, PPTX_DEFAULT_LINE_COLOR),
              width: element.strokeWidth,
              transparency: opacityToTransparency(element.strokeOpacity ?? element.opacity),
              dashType:
                element.dash === 'solid' ? 'solid' : element.dash === 'dot' ? 'sysDot' : 'dash',
              beginArrowType: segment.hasBeginArrow ? element.beginArrow : 'none',
              endArrowType: segment.hasEndArrow ? element.endArrow : 'none',
            },
          })
        }
        continue
      }

      if (element.kind === 'image') {
        const imageOptions = buildImageOptions(element)
        slide.addImage(imageOptions)
        continue
      }

      if (element.kind === 'text') {
        const maxFontSizePt = getMaxTextBoxFontSizePt(element)

        slide.addText(toPptxTextRuns(element.runs, maxFontSizePt), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.color, PPTX_DEFAULT_TEXT_COLOR),
          bold: element.runs.length ? element.runs.every((run) => run.bold) : element.bold,
          italic: element.runs.length ? element.runs.every((run) => run.italic) : element.italic,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          lineSpacingMultiple: PPTX_LINE_SPACING_MULTIPLE,
          paraSpaceAfter: 0,
          paraSpaceBefore: 0,
          fill: colorToFill(element.fill, element.fillOpacity ?? element.opacity),
          line: colorToLine(element.stroke, element.strokeWidth, element.strokeOpacity ?? element.opacity),
          rotate: element.rotate,
          flipH: element.flipH,
          flipV: element.flipV,
          fit: 'shrink',
          isTextBox: true,
          shape: element.borderRadius > 0 ? 'roundRect' : 'rect',
          rectRadius: element.borderRadius > 0 ? pxToInches(element.borderRadius) : undefined,
        })
        continue
      }

      if (element.label.trim().length > 0 && element.shape === 'rect') {
        slide.addText(toPptxTextRuns(element.textRuns), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.textColor, PPTX_DEFAULT_TEXT_COLOR),
          bold: element.bold,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          rotate: element.rotate,
          flipH: element.flipH,
          flipV: element.flipV,
          fit: 'shrink',
          isTextBox: true,
          fill: colorToFill(element.fill, element.fillOpacity ?? element.opacity),
          line: colorToLine(element.stroke, element.strokeWidth, element.strokeOpacity ?? element.opacity),
          shape: element.borderRadius > 0 ? 'roundRect' : 'rect',
          rectRadius: element.borderRadius > 0 ? pxToInches(element.borderRadius) : undefined,
        })
        continue
      }

      slide.addShape(toPptxShapeName(element.shape), {
        x: pxToInches(element.x),
        y: pxToInches(element.y),
        w: pxToInches(element.w),
        h: pxToInches(element.h),
        rotate: element.rotate,
        flipH: element.flipH,
        flipV: element.flipV,
        fill: colorToFill(element.fill, element.fillOpacity ?? element.opacity),
        line: colorToLine(element.stroke, element.strokeWidth, element.strokeOpacity ?? element.opacity),
        rectRadius:
          element.shape === 'roundRect' && element.borderRadius > 0
            ? pxToInches(element.borderRadius)
            : undefined,
      })

      if (element.label.trim()) {
        const maxFontSizePt =
          element.shape === 'rect' ? getMaxStackedFontSizePt(element) : undefined

        slide.addText(toPptxTextRuns(element.textRuns, maxFontSizePt), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.textColor, PPTX_DEFAULT_TEXT_COLOR),
          bold: element.bold,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          lineSpacingMultiple: PPTX_LINE_SPACING_MULTIPLE,
          paraSpaceAfter: 0,
          paraSpaceBefore: 0,
          rotate: element.rotate,
          fit: 'shrink',
          isTextBox: true,
          fill: { color: PPTX_DEFAULT_BACKGROUND_COLOR, transparency: PPTX_FULL_TRANSPARENCY },
          line: { color: PPTX_DEFAULT_BACKGROUND_COLOR, transparency: PPTX_FULL_TRANSPARENCY, width: 0 },
          shape: 'rect',
        })
      }
    }
  }

  return pptx
}

type PptxLineSegment = Pick<NormalizedLineElement, 'x1' | 'x2' | 'y1' | 'y2'> & {
  hasBeginArrow: boolean
  hasEndArrow: boolean
}

function toPptxLineSegments(element: NormalizedLineElement): PptxLineSegment[] {
  if (element.lineType !== 'elbow') {
    return [{ x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y2, hasBeginArrow: true, hasEndArrow: true }]
  }

  return [
    { x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y1, hasBeginArrow: true, hasEndArrow: false },
    { x1: element.x2, x2: element.x2, y1: element.y1, y2: element.y2, hasBeginArrow: false, hasEndArrow: true },
  ].filter((segment) => segment.x1 !== segment.x2 || segment.y1 !== segment.y2)
}

function toPptxLineGeometry(element: Pick<NormalizedLineElement, 'x1' | 'x2' | 'y1' | 'y2'>) {
  return {
    x: Math.min(element.x1, element.x2),
    y: Math.min(element.y1, element.y2),
    w: Math.abs(element.x2 - element.x1),
    h: Math.abs(element.y2 - element.y1),
    flipH: element.x2 < element.x1,
    flipV: element.y2 < element.y1,
  }
}

function buildImageOptions(element: NormalizedImageElement) {
  const crop = element.crop
  const visibleWidth = crop
    ? Math.max(1 - crop.left - crop.right, PPTX_MIN_VISIBLE_CROP_FRACTION)
    : DEFAULT_OPACITY
  const visibleHeight = crop
    ? Math.max(1 - crop.top - crop.bottom, PPTX_MIN_VISIBLE_CROP_FRACTION)
    : DEFAULT_OPACITY
  const sourceBoxWidth = element.w / visibleWidth
  const sourceBoxHeight = element.h / visibleHeight
  const base = {
    x: pxToInches(element.x),
    y: pxToInches(element.y),
    w: pxToInches(sourceBoxWidth),
    h: pxToInches(sourceBoxHeight),
    altText: element.altText,
    transparency: opacityToTransparency(element.opacity),
    rotate: element.rotate,
    flipH: element.flipH,
    flipV: element.flipV,
    sizing: crop
      ? {
          type: 'crop' as const,
          x: pxToInches(crop.left * sourceBoxWidth),
          y: pxToInches(crop.top * sourceBoxHeight),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
        }
      : undefined,
  }

  if (element.src.startsWith('data:')) {
    return {
      ...base,
      data: element.src,
    }
  }

  return {
    ...base,
    path: element.src,
  }
}

function toPptxTextRuns(runs: NormalizedTextRun[], maxFontSizePt?: number) {
  return runs.map((run, index) => ({
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline ? {} : undefined,
      breakLine: run.breakLine && index < runs.length - 1,
      color: cleanHex(run.color, PPTX_DEFAULT_TEXT_COLOR),
      fontFace: run.fontFace,
      fontSize: Math.min(run.fontSize, maxFontSizePt ?? run.fontSize),
    },
  }))
}

function getMaxStackedFontSizePt(element: NormalizedShapeElement) {
  const lineCount = Math.max(
    element.textRuns.reduce(
      (count, run) => count + Math.max(run.text.split('\n').length, PPTX_MIN_DIMENSION_PX),
      0,
    ),
    element.label.split('\n').length,
    PPTX_MIN_DIMENSION_PX,
  )
  const largestRunSize = Math.max(...element.textRuns.map((run) => run.fontSize), element.fontSize)
  const availableHeight = Math.max(element.h - element.padding * 2, PPTX_MIN_DIMENSION_PX)
  const heightLimitedSize = availableHeight / (lineCount * PPTX_STACKED_LINE_HEIGHT_MULTIPLE)

  return Math.max(Math.min(largestRunSize, heightLimitedSize), PPTX_MIN_FONT_SIZE_PT)
}

function getMaxTextBoxFontSizePt(element: NormalizedTextElement) {
  if (!element.runs.length) {
    return undefined
  }

  const largestRunSize = Math.max(...element.runs.map((run) => run.fontSize), element.fontSize)
  const availableHeight = Math.max(element.h - element.padding * 2, PPTX_MIN_DIMENSION_PX)
  const availableWidth = Math.max(element.w - element.padding * 2, PPTX_MIN_DIMENSION_PX)
  const estimatedHeight = estimateTextRunHeight(element.runs, element.text, availableWidth)

  if (estimatedHeight <= availableHeight) {
    return largestRunSize
  }

  return Math.max(
    largestRunSize * (availableHeight / estimatedHeight) * PPTX_TEXT_SHRINK_FACTOR,
    PPTX_MIN_FONT_SIZE_PT,
  )
}

function estimateTextRunHeight(
  runs: NormalizedTextRun[],
  fallbackText: string,
  availableWidth: number,
) {
  const lines = getTextRunLines(runs, fallbackText)

  return lines.reduce((height, line) => {
    const fontSize = Math.max(line.fontSize, PPTX_MIN_DIMENSION_PX)
    const averageGlyphWidth = fontSize * PPTX_AVERAGE_GLYPH_WIDTH_FACTOR
    const charactersPerLine = Math.max(
      Math.floor(availableWidth / averageGlyphWidth),
      PPTX_MIN_DIMENSION_PX,
    )
    const wrappedLineCount = Math.max(
      Math.ceil(line.text.trim().length / charactersPerLine),
      PPTX_MIN_DIMENSION_PX,
    )

    return height + wrappedLineCount * fontSize * PPTX_LINE_SPACING_MULTIPLE
  }, 0)
}

function getTextRunLines(runs: NormalizedTextRun[], fallbackText: string) {
  if (!runs.length) {
    return fallbackText.split('\n').map((line) => ({
      fontSize: PPTX_DEFAULT_FONT_SIZE_PT,
      text: line,
    }))
  }

  const lines: { fontSize: number; text: string }[] = []
  let currentLine = ''
  let currentFontSize = runs[0]?.fontSize ?? PPTX_DEFAULT_FONT_SIZE_PT

  for (const run of runs) {
    const parts = run.text.split('\n')

    parts.forEach((part, index) => {
      currentLine += part
      currentFontSize = Math.max(currentFontSize, run.fontSize)

      if (index < parts.length - 1) {
        lines.push({ fontSize: currentFontSize, text: currentLine })
        currentLine = ''
        currentFontSize = run.fontSize
      }
    })

    if (run.breakLine) {
      lines.push({ fontSize: currentFontSize, text: currentLine })
      currentLine = ''
      currentFontSize = run.fontSize
    }
  }

  if (currentLine || !lines.length) {
    lines.push({ fontSize: currentFontSize, text: currentLine })
  }

  return lines
}

function colorToFill(color: string, opacity = DEFAULT_OPACITY) {
  if (color === 'transparent') {
    return { color: PPTX_DEFAULT_BACKGROUND_COLOR, transparency: PPTX_FULL_TRANSPARENCY }
  }

  return {
    color: cleanHex(color, PPTX_DEFAULT_BACKGROUND_COLOR),
    transparency: opacityToTransparency(opacity),
  }
}

function colorToLine(color: string, width: number, opacity = DEFAULT_OPACITY) {
  if (color === 'transparent' || width <= 0) {
    return {
      color: PPTX_DEFAULT_BACKGROUND_COLOR,
      transparency: PPTX_FULL_TRANSPARENCY,
      width: 0,
    }
  }

  return {
    color: cleanHex(color, PPTX_DEFAULT_LINE_COLOR),
    transparency: opacityToTransparency(opacity),
    width,
  }
}
