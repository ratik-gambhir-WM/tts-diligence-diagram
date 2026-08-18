import type { ReactNode } from 'react'

import type { NormalizedShapeElement } from '../export/PowerpointTypes'
import { toSvgColor } from './svgUtils'

export const SUPPORTED_SHAPE_NAMES = new Set([
  'chevron',
  'diamond',
  'ellipse',
  'flowChartMagneticDisk',
  'pie',
  'rect',
  'roundRect',
  'triangle',
])

export function renderShapePrimitive(element: NormalizedShapeElement): ReactNode {
  const common = {
    fill: toSvgColor(element.fill),
    stroke: toSvgColor(element.stroke),
    strokeWidth: element.strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  }
  const inset = element.strokeWidth / 2
  const width = Math.max(element.w - element.strokeWidth, 0)
  const height = Math.max(element.h - element.strokeWidth, 0)

  switch (element.shape) {
    case 'ellipse':
      return (
        <ellipse
          {...common}
          cx={element.w / 2}
          cy={element.h / 2}
          rx={width / 2}
          ry={height / 2}
        />
      )
    case 'triangle':
      return (
        <polygon
          {...common}
          points={`${element.w / 2},${inset} ${element.w - inset},${element.h - inset} ${inset},${element.h - inset}`}
        />
      )
    case 'pie':
      return (
        <path
          {...common}
          d={`M ${element.w / 2} ${element.h / 2} L ${element.w / 2} ${inset} A ${width / 2} ${height / 2} 0 0 1 ${element.w - inset} ${element.h / 2} Z`}
        />
      )
    case 'diamond':
      return (
        <polygon
          {...common}
          points={`${element.w / 2},${inset} ${element.w - inset},${element.h / 2} ${element.w / 2},${element.h - inset} ${inset},${element.h / 2}`}
        />
      )
    case 'chevron':
      return (
        <polygon
          {...common}
          points={`${inset},${inset} ${element.w * 0.78},${inset} ${element.w - inset},${element.h / 2} ${element.w * 0.78},${element.h - inset} ${inset},${element.h - inset} ${element.w * 0.22},${element.h / 2}`}
        />
      )
    case 'flowChartMagneticDisk': {
      const capHeight = Math.min(element.h * 0.22, 18)
      return (
        <>
          <path
            {...common}
            d={`M ${inset} ${capHeight / 2} C ${inset} ${-capHeight / 6}, ${element.w - inset} ${-capHeight / 6}, ${element.w - inset} ${capHeight / 2} L ${element.w - inset} ${element.h - capHeight / 2} C ${element.w - inset} ${element.h + capHeight / 6}, ${inset} ${element.h + capHeight / 6}, ${inset} ${element.h - capHeight / 2} Z`}
          />
          <ellipse
            cx={element.w / 2}
            cy={capHeight / 2}
            fill="none"
            rx={width / 2}
            ry={capHeight / 2}
            stroke={common.stroke}
            strokeWidth={common.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )
    }
    case 'roundRect':
    case 'rect':
      return (
        <rect
          {...common}
          height={height}
          rx={Math.max(element.borderRadius, element.shape === 'roundRect' ? 18 : 0)}
          width={width}
          x={inset}
          y={inset}
        />
      )
    default:
      return (
        <rect
          fill="rgba(255, 0, 80, 0.08)"
          height={height}
          stroke="#ff0050"
          strokeDasharray="6 4"
          strokeWidth={Math.max(element.strokeWidth, 1)}
          width={width}
          x={inset}
          y={inset}
        />
      )
  }
}

