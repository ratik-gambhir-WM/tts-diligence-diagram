import { memo, type PointerEvent as ReactPointerEvent } from 'react'

import {
  getElementAccessibleLabel,
  type SlideElementRef,
} from '../slide-canvas'
import { SvgImage } from './SvgImage'
import { getLinePath, SvgLine } from './SvgLine'
import { SvgShape } from './SvgShape'
import { SvgTextBlock } from './SvgText'

export const SvgElement = memo(function SvgElement({
  definitionPrefix,
  elementRef,
  isEditing,
  onDoubleClick,
  onPointerDown,
  textFontScale,
}: {
  definitionPrefix: string
  elementRef: SlideElementRef
  isEditing: boolean
  onDoubleClick: (ref: SlideElementRef) => void
  onPointerDown: (ref: SlideElementRef, event: ReactPointerEvent<SVGElement>) => void
  textFontScale?: number
}) {
  const element = elementRef.element
  const label = getElementAccessibleLabel(element)
  const supportsTextEditing = element.kind === 'shape' || element.kind === 'text'
  const title = supportsTextEditing
    ? `${label}. Click again, double-click, or press Enter to edit.`
    : label
  const clipId = `${definitionPrefix}-clip`
  const textClipId = `${definitionPrefix}-text-clip`

  if (element.kind === 'line') {
    return (
      <g
        aria-label={label}
        className="svg-slide-element svg-slide-element-line"
        data-element-key={elementRef.key}
        onPointerDown={(event) => onPointerDown(elementRef, event)}
        opacity={element.opacity}
        role="button"
        tabIndex={-1}
      >
        <SvgLine
          element={element}
          markerId={`${definitionPrefix}-marker`}
          maskId={`${definitionPrefix}-mask`}
        />
        <path
          className="svg-slide-hit-target"
          d={getLinePath(element)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(element.strokeWidth, 16)}
        />
      </g>
    )
  }

  const transform = `translate(${element.x} ${element.y})${element.rotate ? ` rotate(${element.rotate} ${element.w / 2} ${element.h / 2})` : ''}`
  return (
    <g
      aria-label={label}
      aria-keyshortcuts={supportsTextEditing ? 'Enter' : undefined}
      className={`svg-slide-element svg-slide-element-${element.kind}`}
      data-element-key={elementRef.key}
      onDoubleClick={
        supportsTextEditing
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onDoubleClick(elementRef)
            }
          : undefined
      }
      onPointerDown={(event) => onPointerDown(elementRef, event)}
      opacity={element.opacity}
      role="button"
      tabIndex={-1}
      transform={transform}
    >
      <title>{title}</title>
      {element.kind === 'shape' ? (
        <SvgShape
          element={element}
          fontScale={textFontScale}
          hideText={isEditing}
          textClipId={textClipId}
        />
      ) : element.kind === 'text' ? (
        <SvgTextBlock
          clipId={textClipId}
          element={element}
          fontScale={textFontScale}
          hideText={isEditing}
          paintBox
        />
      ) : (
        <SvgImage clipId={clipId} element={element} />
      )}
      <rect
        className="svg-slide-hit-target"
        fill="transparent"
        height={element.h}
        width={element.w}
        x={0}
        y={0}
      />
    </g>
  )
})
