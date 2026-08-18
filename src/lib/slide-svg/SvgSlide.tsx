import { memo, type PointerEvent as ReactPointerEvent } from 'react'

import type { NormalizedSlide } from '../export/PowerpointTypes'
import type { SlideElementRef } from '../slide-canvas'
import { SvgBrandFrame } from './SvgBrandFrame'
import { SvgElement } from './SvgElement'
import { sanitizeSvgId, toSvgColor } from './svgUtils'

const EMPTY_TEXT_FONT_SCALES = new Map<string, number>()

export const SvgSlide = memo(function SvgSlide({
  canvasId,
  editingKey,
  elementRefs,
  onElementDoubleClick,
  onElementPointerDown,
  onSlidePointerDown,
  slide,
  textFontScales = EMPTY_TEXT_FONT_SCALES,
}: {
  canvasId: string
  editingKey?: string
  elementRefs: SlideElementRef[]
  onElementDoubleClick: (ref: SlideElementRef) => void
  onElementPointerDown: (ref: SlideElementRef, event: ReactPointerEvent<SVGElement>) => void
  onSlidePointerDown: (event: ReactPointerEvent<SVGRectElement>) => void
  slide: NormalizedSlide
  textFontScales?: ReadonlyMap<string, number>
}) {
  return (
    <>
      <rect
        aria-label={slide.name}
        fill={toSvgColor(slide.backgroundColor)}
        height={slide.height}
        onPointerDown={onSlidePointerDown}
        width={slide.width}
        x={0}
        y={0}
      />
      <SvgBrandFrame height={slide.height} width={slide.width} />
      {elementRefs.map((elementRef) => (
        <SvgElement
          definitionPrefix={`${canvasId}-${sanitizeSvgId(elementRef.key)}`}
          elementRef={elementRef}
          isEditing={editingKey === elementRef.key}
          key={elementRef.key}
          onDoubleClick={onElementDoubleClick}
          onPointerDown={onElementPointerDown}
          textFontScale={textFontScales.get(elementRef.key)}
        />
      ))}
    </>
  )
})
