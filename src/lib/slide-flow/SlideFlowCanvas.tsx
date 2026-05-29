import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import { useEffect, useMemo, type CSSProperties } from 'react'
import '@xyflow/react/dist/style.css'

import type {
  NormalizedLineElement,
  NormalizedShapeElement,
  NormalizedTextElement,
  NormalizedTextRun,
} from '../export/PowerpointGenerator'
import { buildSlideFlowModel, type SlideFlowNodeData } from './model'
import './slide-flow.css'

export interface SlideFlowCanvasProps {
  className?: string
  input: unknown
  slideIndex?: number
}

const nodeTypes: NodeTypes = {
  slideBackground: SlideBackgroundNode,
  slideElement: SlideElementNode,
}

export function SlideFlowCanvas({ className, input, slideIndex = 0 }: SlideFlowCanvasProps) {
  const model = useMemo(() => buildSlideFlowModel(input, { slideIndex }), [input, slideIndex])
  const slide = model.slide
  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes)

  useEffect(() => {
    setNodes(model.nodes)
  }, [model.nodes, setNodes])

  if (!slide) {
    return (
      <div className={['slide-flow-empty', className].filter(Boolean).join(' ')}>
        Unable to render this slide template.
      </div>
    )
  }

  return (
    <div
      className={['slide-flow-canvas', className].filter(Boolean).join(' ')}
      style={{ '--slide-flow-bg': toCssColor(slide.backgroundColor) } as CSSProperties}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.035 }}
          minZoom={0.15}
          maxZoom={4}
          onNodesChange={onNodesChange}
          nodesConnectable={false}
          nodesDraggable
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d9deea" gap={32} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

function SlideBackgroundNode({ data }: NodeProps) {
  const nodeData = data as SlideFlowNodeData

  if (nodeData.kind !== 'background') {
    return null
  }

  return (
    <div
      className="slide-flow-background-node"
      style={{
        backgroundColor: toCssColor(nodeData.slide.backgroundColor),
        height: nodeData.slide.height,
        width: nodeData.slide.width,
      }}
      aria-label={nodeData.slide.name}
    />
  )
}

function SlideElementNode({ data }: NodeProps) {
  const nodeData = data as SlideFlowNodeData

  if (nodeData.kind !== 'element') {
    return null
  }

  const element = nodeData.element

  if (element.kind === 'line') {
    return <SlideLineElement element={element} />
  }

  if (element.kind === 'text') {
    return <SlideTextElement element={element} />
  }

  if (element.kind === 'image') {
    return (
      <img
        className="slide-flow-image-element"
        src={element.src}
        alt={element.altText}
        style={{
          borderRadius: element.borderRadius,
          height: element.h,
          objectFit: element.fit === 'stretch' ? 'fill' : element.fit,
          opacity: element.opacity,
          transform: `rotate(${element.rotate}deg)`,
          width: element.w,
        }}
      />
    )
  }

  return <SlideShapeElement element={element} />
}

function SlideShapeElement({ element }: { element: NormalizedShapeElement }) {
  const shapeStyle = getSharedBoxStyle(element)
  const textStyle = getTextBoxStyle(element)
  const label = <SlideTextRuns runs={element.textRuns} fallbackText={element.label} />

  if (element.shape === 'ellipse') {
    return (
      <div className="slide-flow-shape-node" style={shapeStyle}>
        <svg className="slide-flow-shape-svg" viewBox={`0 0 ${element.w} ${element.h}`}>
          <ellipse
            cx={element.w / 2}
            cy={element.h / 2}
            fill={toCssColor(element.fill)}
            opacity={element.opacity}
            rx={Math.max(element.w / 2 - element.strokeWidth / 2, 0)}
            ry={Math.max(element.h / 2 - element.strokeWidth / 2, 0)}
            stroke={toCssColor(element.stroke)}
            strokeWidth={element.strokeWidth}
          />
        </svg>
        {element.label.trim() && (
          <div className="slide-flow-shape-label" style={textStyle}>
            {label}
          </div>
        )}
      </div>
    )
  }

  if (element.shape === 'diamond') {
    return (
      <div className="slide-flow-shape-node" style={shapeStyle}>
        <svg className="slide-flow-shape-svg" viewBox={`0 0 ${element.w} ${element.h}`}>
          <polygon
            fill={toCssColor(element.fill)}
            opacity={element.opacity}
            points={`${element.w / 2},0 ${element.w},${element.h / 2} ${element.w / 2},${element.h} 0,${element.h / 2}`}
            stroke={toCssColor(element.stroke)}
            strokeWidth={element.strokeWidth}
          />
        </svg>
        {element.label.trim() && (
          <div className="slide-flow-shape-label" style={textStyle}>
            {label}
          </div>
        )}
      </div>
    )
  }

  if (element.shape === 'chevron') {
    return (
      <div className="slide-flow-shape-node" style={shapeStyle}>
        <svg className="slide-flow-shape-svg" viewBox={`0 0 ${element.w} ${element.h}`}>
          <polygon
            fill={toCssColor(element.fill)}
            opacity={element.opacity}
            points={`0,0 ${element.w * 0.78},0 ${element.w},${element.h / 2} ${element.w * 0.78},${element.h} 0,${element.h} ${element.w * 0.22},${element.h / 2}`}
            stroke={toCssColor(element.stroke)}
            strokeWidth={element.strokeWidth}
          />
        </svg>
        {element.label.trim() && (
          <div className="slide-flow-shape-label" style={textStyle}>
            {label}
          </div>
        )}
      </div>
    )
  }

  if (element.shape === 'flowChartMagneticDisk') {
    const capHeight = Math.min(element.h * 0.22, 18)

    return (
      <div className="slide-flow-shape-node" style={shapeStyle}>
        <svg className="slide-flow-shape-svg" viewBox={`0 0 ${element.w} ${element.h}`}>
          <path
            d={`M ${element.strokeWidth / 2} ${capHeight / 2}
              C ${element.strokeWidth / 2} ${-capHeight / 6}, ${element.w - element.strokeWidth / 2} ${-capHeight / 6}, ${element.w - element.strokeWidth / 2} ${capHeight / 2}
              L ${element.w - element.strokeWidth / 2} ${element.h - capHeight / 2}
              C ${element.w - element.strokeWidth / 2} ${element.h + capHeight / 6}, ${element.strokeWidth / 2} ${element.h + capHeight / 6}, ${element.strokeWidth / 2} ${element.h - capHeight / 2}
              Z`}
            fill={toCssColor(element.fill)}
            opacity={element.opacity}
            stroke={toCssColor(element.stroke)}
            strokeWidth={element.strokeWidth}
          />
          <ellipse
            cx={element.w / 2}
            cy={capHeight / 2}
            fill="none"
            rx={Math.max(element.w / 2 - element.strokeWidth / 2, 0)}
            ry={capHeight / 2}
            stroke={toCssColor(element.stroke)}
            strokeWidth={element.strokeWidth}
          />
        </svg>
        {element.label.trim() && (
          <div className="slide-flow-shape-label" style={textStyle}>
            {label}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="slide-flow-rect-element" style={{ ...shapeStyle, ...getShapePaintStyle(element) }}>
      {element.label.trim() && (
        <div className="slide-flow-rect-label" style={textStyle}>
          {label}
        </div>
      )}
    </div>
  )
}

function SlideTextElement({ element }: { element: NormalizedTextElement }) {
  const paintStyle = getTextPaintStyle(element)

  return (
    <div
      className="slide-flow-text-element"
      style={{
        ...getSharedBoxStyle(element),
        ...paintStyle,
        ...getTextBoxStyle(element),
      }}
    >
      <SlideTextRuns runs={element.runs} fallbackText={element.text} />
    </div>
  )
}

function SlideLineElement({ element }: { element: NormalizedLineElement }) {
  const width = Math.max(Math.abs(element.x2 - element.x1), Math.max(element.strokeWidth, 1))
  const height = Math.max(Math.abs(element.y2 - element.y1), Math.max(element.strokeWidth, 1))
  const x1 = element.x1 <= element.x2 ? 0 : width
  const x2 = element.x1 <= element.x2 ? width : 0
  const y1 = element.y1 <= element.y2 ? 0 : height
  const y2 = element.y1 <= element.y2 ? height : 0
  const markerId = `${element.id}-arrow`

  return (
    <svg
      className="slide-flow-line-element"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        height,
        overflow: 'visible',
        transform: `rotate(${element.rotate}deg)`,
        width,
      }}
    >
      <defs>
        <marker
          id={markerId}
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
          viewBox="0 0 8 8"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill={toCssColor(element.stroke)} />
        </marker>
      </defs>
      <line
        x1={x1}
        x2={x2}
        y1={y1}
        y2={y2}
        opacity={element.opacity}
        stroke={toCssColor(element.stroke)}
        strokeDasharray={getStrokeDasharray(element)}
        strokeLinecap="round"
        strokeWidth={element.strokeWidth}
        markerEnd={element.endArrow === 'none' ? undefined : `url(#${markerId})`}
      />
    </svg>
  )
}

function SlideTextRuns({
  fallbackText,
  runs,
}: {
  fallbackText: string
  runs: NormalizedTextRun[]
}) {
  if (!runs.length) {
    return <>{fallbackText}</>
  }

  return (
    <>
      {runs.map((run, index) => (
        <span
          key={`${run.text}-${index}`}
          style={{
            color: toCssColor(run.color),
            fontFamily: run.fontFace,
            fontSize: `${run.fontSize}pt`,
            fontStyle: run.italic ? 'italic' : undefined,
            fontWeight: run.bold ? 700 : 400,
            textDecoration: run.underline ? 'underline' : undefined,
          }}
        >
          {run.text}
          {run.breakLine && <br />}
        </span>
      ))}
    </>
  )
}

function getSharedBoxStyle(
  element: NormalizedShapeElement | NormalizedTextElement,
): CSSProperties {
  return {
    height: element.h,
    opacity: element.opacity,
    transform: `rotate(${element.rotate}deg)`,
    width: element.w,
  }
}

function getShapePaintStyle(element: NormalizedShapeElement | NormalizedTextElement): CSSProperties {
  return {
    backgroundColor: toCssColor(element.fill),
    border:
      element.strokeWidth > 0 && element.stroke !== 'transparent'
        ? `${element.strokeWidth}px solid ${toCssColor(element.stroke)}`
        : '0 solid transparent',
    borderRadius: element.borderRadius,
  }
}

function getTextPaintStyle(element: NormalizedTextElement): CSSProperties {
  const shouldInferMissingFill =
    element.fill === 'transparent' &&
    element.stroke === 'transparent' &&
    element.color === 'FFFFFF' &&
    element.text.trim().length > 0

  if (!shouldInferMissingFill) {
    return getShapePaintStyle(element)
  }

  const inferredFill = element.h >= 150 ? 'D0D7E5' : '0B0055'

  return {
    backgroundColor: toCssColor(inferredFill),
    border: '0 solid transparent',
    borderRadius: element.borderRadius,
  }
}

function getTextBoxStyle(element: NormalizedShapeElement | NormalizedTextElement): CSSProperties {
  return {
    alignItems: toFlexAlign(element.valign),
    color: toCssColor('color' in element ? element.color : element.textColor),
    display: 'flex',
    fontFamily: element.fontFace,
    fontSize: `${element.fontSize}pt`,
    fontWeight: element.bold ? 700 : 400,
    justifyContent: toFlexJustify(element.align),
    lineHeight: 1.08,
    padding: `${element.padding}pt`,
    textAlign: element.align,
    whiteSpace: 'pre-wrap',
  }
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

function toFlexAlign(valign: 'top' | 'middle' | 'bottom') {
  if (valign === 'bottom') {
    return 'flex-end'
  }

  if (valign === 'middle') {
    return 'center'
  }

  return 'flex-start'
}

function toFlexJustify(align: 'left' | 'center' | 'right') {
  if (align === 'right') {
    return 'flex-end'
  }

  if (align === 'center') {
    return 'center'
  }

  return 'flex-start'
}

function toCssColor(color: string) {
  if (!color || color === 'transparent') {
    return 'transparent'
  }

  return color.startsWith('#') ? color : `#${color}`
}
