import { memo, type PointerEvent as ReactPointerEvent } from 'react'

import type { SlideElementRef } from '../slide-canvas'
import { getLinePath } from './SvgLine'
import type { ResizeHandle } from './useSvgInteraction'

const HANDLE_SPECS: Array<{
  handle: ResizeHandle
  x: number
  y: number
}> = [
  { handle: 'nw', x: 0, y: 0 },
  { handle: 'n', x: 0.5, y: 0 },
  { handle: 'ne', x: 1, y: 0 },
  { handle: 'e', x: 1, y: 0.5 },
  { handle: 'se', x: 1, y: 1 },
  { handle: 's', x: 0.5, y: 1 },
  { handle: 'sw', x: 0, y: 1 },
  { handle: 'w', x: 0, y: 0.5 },
]

export const SvgSelection = memo(function SvgSelection({
  elementRef,
  onLinePointPointerDown,
  onResizePointerDown,
}: {
  elementRef: SlideElementRef
  onLinePointPointerDown: (
    ref: SlideElementRef,
    point: 'end' | 'start',
    event: ReactPointerEvent<SVGElement>,
  ) => void
  onResizePointerDown: (
    ref: SlideElementRef,
    handle: ResizeHandle,
    event: ReactPointerEvent<SVGElement>,
  ) => void
}) {
  const element = elementRef.element
  if (element.kind === 'line') {
    return (
      <g className="svg-slide-selection">
        <path
          d={getLinePath(element)}
          fill="none"
          pointerEvents="none"
          stroke="var(--slide-canvas-selection)"
          strokeDasharray="5 4"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <LineHandle
          label="Move line start"
          onPointerDown={(event) => onLinePointPointerDown(elementRef, 'start', event)}
          x={element.x1}
          y={element.y1}
        />
        <LineHandle
          label="Move line end"
          onPointerDown={(event) => onLinePointPointerDown(elementRef, 'end', event)}
          x={element.x2}
          y={element.y2}
        />
      </g>
    )
  }

  const transform = `translate(${element.x} ${element.y})${element.rotate ? ` rotate(${element.rotate} ${element.w / 2} ${element.h / 2})` : ''}`
  return (
    <g className="svg-slide-selection" transform={transform}>
      <rect
        fill="none"
        height={element.h}
        pointerEvents="none"
        stroke="var(--slide-canvas-selection)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        width={element.w}
        x={0}
        y={0}
      />
      {HANDLE_SPECS.map((handle) => (
        <rect
          aria-label={`Resize ${handle.handle}`}
          className="svg-slide-resize-handle"
          height={10}
          key={handle.handle}
          onPointerDown={(event) => onResizePointerDown(elementRef, handle.handle, event)}
          role="button"
          width={10}
          x={element.w * handle.x - 5}
          y={element.h * handle.y - 5}
        />
      ))}
    </g>
  )
})

function LineHandle({
  label,
  onPointerDown,
  x,
  y,
}: {
  label: string
  onPointerDown: (event: ReactPointerEvent<SVGElement>) => void
  x: number
  y: number
}) {
  return (
    <circle
      aria-label={label}
      className="svg-slide-line-handle"
      cx={x}
      cy={y}
      onPointerDown={onPointerDown}
      r={7}
      role="button"
    />
  )
}

