import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  CSSProperties,
} from 'react'

import type { NormalizedSlide } from '../export/PowerpointTypes'

export function SvgSlideViewport({
  children,
  clipId,
  onKeyDown,
  onPointerMove,
  onPointerUp,
  slide,
  svgRef,
  viewportSize,
}: {
  children: ReactNode
  clipId: string
  onKeyDown: (event: ReactKeyboardEvent<SVGSVGElement>) => void
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
  slide: NormalizedSlide
  svgRef: RefObject<SVGSVGElement | null>
  viewportSize?: { height: number; width: number }
}) {
  return (
    <svg
      aria-label={`${slide.name} editable slide canvas`}
      className="svg-slide-viewport"
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      preserveAspectRatio="xMidYMid meet"
      ref={svgRef}
      role="application"
      style={
        viewportSize
          ? ({ height: viewportSize.height, width: viewportSize.width } as CSSProperties)
          : undefined
      }
      tabIndex={0}
      viewBox={`0 0 ${slide.width} ${slide.height}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect height={slide.height} width={slide.width} x={0} y={0} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </svg>
  )
}
