import { memo } from 'react'

import type { NormalizedLineElement } from '../export/PowerpointTypes'
import { toSvgColor } from './svgUtils'

export const SvgLine = memo(function SvgLine({
  element,
  markerId,
  maskId,
}: {
  element: NormalizedLineElement
  markerId: string
  maskId: string
}) {
  const hasArrow = element.endArrow !== 'none'
  const hasMask = element.occlusionRects.length > 0
  const midX = (element.x1 + element.x2) / 2
  const midY = (element.y1 + element.y2) / 2
  const path = getLinePath(element)

  return (
    <g transform={element.rotate ? `rotate(${element.rotate} ${midX} ${midY})` : undefined}>
      <defs>
        {hasArrow ? (
          <marker
            id={markerId}
            markerHeight="10"
            markerUnits="userSpaceOnUse"
            markerWidth="10"
            orient="auto"
            refX="9"
            refY="5"
            viewBox="0 0 10 10"
          >
            {renderArrowMarker(element)}
          </marker>
        ) : null}
        {hasMask ? (
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-4096" y="-4096" width="8192" height="8192">
            <rect fill="white" height="8192" width="8192" x="-4096" y="-4096" />
            {element.occlusionRects.map((rect, index) => (
              <rect
                fill="black"
                height={rect.h + 3}
                key={`${index}-${rect.x}-${rect.y}`}
                width={rect.w + 3}
                x={rect.x - 1.5}
                y={rect.y - 1.5}
              />
            ))}
          </mask>
        ) : null}
      </defs>
      <path
        d={path}
        fill="none"
        markerEnd={hasArrow ? `url(#${markerId})` : undefined}
        mask={hasMask ? `url(#${maskId})` : undefined}
        stroke={toSvgColor(element.stroke)}
        strokeDasharray={getStrokeDasharray(element)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={element.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
})

export function getLinePath(element: NormalizedLineElement) {
  return element.lineType === 'elbow'
    ? `M ${element.x1} ${element.y1} L ${element.x2} ${element.y1} L ${element.x2} ${element.y2}`
    : `M ${element.x1} ${element.y1} L ${element.x2} ${element.y2}`
}

function renderArrowMarker(element: NormalizedLineElement) {
  const color = toSvgColor(element.stroke)
  if (element.endArrow === 'diamond') {
    return <path d="M 0 5 L 5 0 L 10 5 L 5 10 Z" fill={color} />
  }
  if (element.endArrow === 'oval') {
    return <circle cx="5" cy="5" fill={color} r="4" />
  }
  if (element.endArrow === 'arrow') {
    return <path d="M 1 1 L 9 5 L 1 9 L 3.5 5 Z" fill={color} />
  }
  if (element.endArrow === 'stealth') {
    return <path d="M 0 1 L 10 5 L 0 9 L 3 5 Z" fill={color} />
  }
  return <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
}

function getStrokeDasharray(element: NormalizedLineElement) {
  if (element.dash === 'dash') {
    return `${element.strokeWidth * 5} ${element.strokeWidth * 3}`
  }
  if (element.dash === 'dot') {
    return `${element.strokeWidth} ${element.strokeWidth * 3}`
  }
  return undefined
}

