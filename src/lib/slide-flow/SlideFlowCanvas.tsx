import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import { useMemo, type CSSProperties, type ReactNode } from 'react'
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
  const flowKey = useMemo(() => getFlowKey(model.nodes), [model.nodes])

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
        <SlideFlowGraph key={flowKey} initialNodes={model.nodes} />
      </ReactFlowProvider>
    </div>
  )
}

function SlideFlowGraph({ initialNodes }: { initialNodes: Node<SlideFlowNodeData>[] }) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)

  return (
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
  )
}

function getFlowKey(nodes: Node<SlideFlowNodeData>[]) {
  return JSON.stringify(
    nodes.map((node) => ({
      data: node.data,
      id: node.id,
      position: node.position,
      style: node.style,
      type: node.type,
    })),
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
  const shouldStackRuns = element.shape === 'rect'
  const label = (
    <SlideTextRuns
      fallbackText={element.label}
      maxStackedFontSizePt={shouldStackRuns ? getMaxStackedFontSizePt(element) : undefined}
      runs={element.textRuns}
      stackVertically={shouldStackRuns}
    />
  )

  if (element.shape === 'ellipse') {
    return (
      <SlideSvgShapeFrame element={element} label={label} shapeStyle={shapeStyle} textStyle={textStyle}>
        <SlideEllipseShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  if (element.shape === 'diamond') {
    return (
      <SlideSvgShapeFrame element={element} label={label} shapeStyle={shapeStyle} textStyle={textStyle}>
        <SlideDiamondShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  if (element.shape === 'chevron') {
    return (
      <SlideSvgShapeFrame element={element} label={label} shapeStyle={shapeStyle} textStyle={textStyle}>
        <SlideChevronShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  if (element.shape === 'flowChartMagneticDisk') {
    return (
      <SlideSvgShapeFrame element={element} label={label} shapeStyle={shapeStyle} textStyle={textStyle}>
        <SlideMagneticDiskShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  return (
    <SlideRectShape
      element={element}
      label={label}
      shapeStyle={shapeStyle}
      textStyle={getStackedTextBoxStyle(element)}
    />
  )
}

function SlideSvgShapeFrame({
  children,
  element,
  label,
  shapeStyle,
  textStyle,
}: {
  children: ReactNode
  element: NormalizedShapeElement
  label: ReactNode
  shapeStyle: CSSProperties
  textStyle: CSSProperties
}) {
  return (
    <div className="slide-flow-shape-node" style={shapeStyle}>
      <svg className="slide-flow-shape-svg" viewBox={`0 0 ${element.w} ${element.h}`}>
        {children}
      </svg>
      <SlideShapeLabel className="slide-flow-shape-label" element={element} label={label} style={textStyle} />
    </div>
  )
}

function SlideRectShape({
  element,
  label,
  shapeStyle,
  textStyle,
}: {
  element: NormalizedShapeElement
  label: ReactNode
  shapeStyle: CSSProperties
  textStyle: CSSProperties
}) {
  return (
    <div className="slide-flow-rect-element" style={{ ...shapeStyle, ...getShapePaintStyle(element) }}>
      <SlideShapeLabel className="slide-flow-rect-label" element={element} label={label} style={textStyle} />
    </div>
  )
}

function SlideShapeLabel({
  className,
  element,
  label,
  style,
}: {
  className: string
  element: NormalizedShapeElement
  label: ReactNode
  style: CSSProperties
}) {
  if (!element.label.trim()) {
    return null
  }

  return (
    <div className={className} style={style}>
      {label}
    </div>
  )
}

function SlideEllipseShape({ element }: { element: NormalizedShapeElement }) {
  return (
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
  )
}

function SlideDiamondShape({ element }: { element: NormalizedShapeElement }) {
  return (
    <polygon
      fill={toCssColor(element.fill)}
      opacity={element.opacity}
      points={`${element.w / 2},0 ${element.w},${element.h / 2} ${element.w / 2},${element.h} 0,${element.h / 2}`}
      stroke={toCssColor(element.stroke)}
      strokeWidth={element.strokeWidth}
    />
  )
}

function SlideChevronShape({ element }: { element: NormalizedShapeElement }) {
  return (
    <polygon
      fill={toCssColor(element.fill)}
      opacity={element.opacity}
      points={`0,0 ${element.w * 0.78},0 ${element.w},${element.h / 2} ${element.w * 0.78},${element.h} 0,${element.h} ${element.w * 0.22},${element.h / 2}`}
      stroke={toCssColor(element.stroke)}
      strokeWidth={element.strokeWidth}
    />
  )
}

function SlideMagneticDiskShape({ element }: { element: NormalizedShapeElement }) {
  const capHeight = Math.min(element.h * 0.22, 18)

  return (
    <>
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
    </>
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
  const hasEndArrow = element.endArrow !== 'none'
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
      <SlideLineArrowMarker color={toCssColor(element.stroke)} id={markerId} isVisible={hasEndArrow} />
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
        markerEnd={hasEndArrow ? `url(#${markerId})` : undefined}
      />
    </svg>
  )
}

function SlideLineArrowMarker({
  color,
  id,
  isVisible,
}: {
  color: string
  id: string
  isVisible: boolean
}) {
  if (!isVisible) {
    return null
  }

  return (
    <defs>
      <marker
        id={id}
        markerHeight="8"
        markerWidth="8"
        orient="auto"
        refX="7"
        refY="4"
        viewBox="0 0 8 8"
      >
        <path d="M 0 0 L 8 4 L 0 8 z" fill={color} />
      </marker>
    </defs>
  )
}

function SlideTextRuns({
  fallbackText,
  maxStackedFontSizePt,
  runs,
  stackVertically = false,
}: {
  fallbackText: string
  maxStackedFontSizePt?: number
  runs: NormalizedTextRun[]
  stackVertically?: boolean
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
            display: stackVertically ? 'block' : undefined,
            fontFamily: run.fontFace,
            fontSize: `${Math.min(run.fontSize, maxStackedFontSizePt ?? run.fontSize)}pt`,
            fontStyle: run.italic ? 'italic' : undefined,
            fontWeight: run.bold ? 700 : 400,
            maxWidth: stackVertically ? '100%' : undefined,
            textDecoration: run.underline ? 'underline' : undefined,
            whiteSpace: 'pre-wrap',
            wordBreak: stackVertically ? 'break-word' : undefined,
          }}
        >
          {run.text}
          {run.breakLine && <br />}
        </span>
      ))}
    </>
  )
}

function getStackedTextBoxStyle(element: NormalizedShapeElement): CSSProperties {
  return {
    ...getTextBoxStyle(element),
    alignItems: toFlexJustify(element.align),
    flexDirection: 'column',
    justifyContent: toFlexAlign(element.valign),
  }
}

function getMaxStackedFontSizePt(element: NormalizedShapeElement) {
  const lineCount = Math.max(
    element.textRuns.reduce((count, run) => count + Math.max(run.text.split('\n').length, 1), 0),
    element.label.split('\n').length,
    1,
  )
  const largestRunSize = Math.max(...element.textRuns.map((run) => run.fontSize), element.fontSize)
  const availableHeight = Math.max(element.h - element.padding * 2, 1)
  const availableWidth = Math.max(element.w - element.padding * 2, 1)
  const longestLineLength = Math.max(
    ...element.textRuns.flatMap((run) => run.text.split('\n').map((line) => line.trim().length)),
    ...element.label.split('\n').map((line) => line.trim().length),
    1,
  )
  const heightLimitedSize = availableHeight / (lineCount * 1.28)
  const widthLimitedSize = availableWidth / (longestLineLength * 0.62)

  return Math.max(Math.min(largestRunSize, heightLimitedSize, widthLimitedSize), 5)
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
