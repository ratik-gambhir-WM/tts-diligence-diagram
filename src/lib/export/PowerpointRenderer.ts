import PptxGenJS from 'pptxgenjs'
import { DEFAULT_FONT_FACE } from './PowerpointConstants'
import type {
  NormalizedImageElement,
  NormalizedLineElement,
  NormalizedPresentation,
  NormalizedTextRun,
} from './PowerpointTypes'
import {
  cleanHex,
  opacityToTransparency,
  pxToInches,
  toPptxShapeName,
  toPptxVerticalAlign,
} from './PowerpointUtils'

export function buildPptxPresentation(presentation: NormalizedPresentation) {
  const pptx = new PptxGenJS()
  const widthInches = pxToInches(presentation.meta.width)
  const heightInches = pxToInches(presentation.meta.height)

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

  for (const slideSpec of presentation.slides) {
    const slide = pptx.addSlide()
    slide.background = { color: cleanHex(slideSpec.backgroundColor, 'FFFFFF') }

    for (const element of slideSpec.elements) {
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
              color: cleanHex(element.stroke, '000000'),
              width: element.strokeWidth,
              transparency: opacityToTransparency(element.opacity),
              dashType:
                element.dash === 'solid' ? 'solid' : element.dash === 'dot' ? 'sysDot' : 'dash',
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
        slide.addText(toPptxTextRuns(element.runs), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.color, '111827'),
          bold: element.bold,
          italic: element.italic,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          fill: colorToFill(element.fill, element.opacity),
          line: colorToLine(element.stroke, element.strokeWidth, element.opacity),
          rotate: element.rotate,
          fit: 'shrink',
          isTextBox: true,
          shape: element.borderRadius > 0 ? 'roundRect' : 'rect',
        })
        continue
      }

      slide.addShape(toPptxShapeName(element.shape), {
        x: pxToInches(element.x),
        y: pxToInches(element.y),
        w: pxToInches(element.w),
        h: pxToInches(element.h),
        rotate: element.rotate,
        fill: colorToFill(element.fill, element.opacity),
        line: colorToLine(element.stroke, element.strokeWidth, element.opacity),
      })

      if (element.label.trim()) {
        slide.addText(toPptxTextRuns(element.textRuns), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.textColor, '111827'),
          bold: element.bold,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          rotate: element.rotate,
          fit: 'shrink',
          isTextBox: true,
          fill: { color: 'FFFFFF', transparency: 100 },
          line: { color: 'FFFFFF', transparency: 100, width: 0 },
          shape: 'rect',
        })
      }
    }
  }

  return pptx
}

type PptxLineSegment = Pick<NormalizedLineElement, 'x1' | 'x2' | 'y1' | 'y2'> & {
  hasEndArrow: boolean
}

function toPptxLineSegments(element: NormalizedLineElement): PptxLineSegment[] {
  if (element.lineType !== 'elbow') {
    return [{ x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y2, hasEndArrow: true }]
  }

  return [
    { x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y1, hasEndArrow: false },
    { x1: element.x2, x2: element.x2, y1: element.y1, y2: element.y2, hasEndArrow: true },
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
  const base = {
    x: pxToInches(element.x),
    y: pxToInches(element.y),
    w: pxToInches(element.w),
    h: pxToInches(element.h),
    altText: element.altText,
    transparency: opacityToTransparency(element.opacity),
    rotate: element.rotate,
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

function toPptxTextRuns(runs: NormalizedTextRun[]) {
  return runs.map((run) => ({
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline ? {} : undefined,
      breakLine: run.breakLine,
      color: cleanHex(run.color, '111827'),
      fontFace: run.fontFace,
      fontSize: run.fontSize,
    },
  }))
}

function colorToFill(color: string, opacity = 1) {
  if (color === 'transparent') {
    return { color: 'FFFFFF', transparency: 100 }
  }

  return { color: cleanHex(color, 'FFFFFF'), transparency: opacityToTransparency(opacity) }
}

function colorToLine(color: string, width: number, opacity = 1) {
  if (color === 'transparent' || width <= 0) {
    return { color: 'FFFFFF', transparency: 100, width: 0 }
  }

  return { color: cleanHex(color, '000000'), transparency: opacityToTransparency(opacity), width }
}
