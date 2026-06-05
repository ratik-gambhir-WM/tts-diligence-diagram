import {
  Background,
  Controls,
  NodeResizer,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import { useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
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
  onChange?: (input: unknown) => void
  slideIndex?: number
}

type ElementEdit = {
  h?: number
  text?: string
  w?: number
  x?: number
  y?: number
}

type SlideFlowNode = Node<SlideFlowNodeData>
type SlideElementNodeData = Extract<SlideFlowNodeData, { kind: 'element' }> & {
  commitElementEdit?: (elementId: string, edit: ElementEdit) => void
}

const nodeTypes: NodeTypes = {
  slideBackground: SlideBackgroundNode,
  slideElement: SlideElementNode,
}

export function SlideFlowCanvas({ className, input, onChange, slideIndex = 0 }: SlideFlowCanvasProps) {
  const model = useMemo(() => buildSlideFlowModel(input, { slideIndex }), [input, slideIndex])
  const slide = model.slide
  const flowKey = useMemo(() => getFlowKey(model.nodes), [model.nodes])
  const handleInputChange = useMemo(() => {
    if (!onChange) {
      return undefined
    }

    return (elementId: string, edit: ElementEdit) => {
      onChange(applyElementEditToInput(input, elementId, edit))
    }
  }, [input, onChange])

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
        <SlideFlowGraph
          key={flowKey}
          initialNodes={model.nodes}
          onElementEdit={handleInputChange}
        />
      </ReactFlowProvider>
    </div>
  )
}

function SlideFlowGraph({
  initialNodes,
  onElementEdit,
}: {
  initialNodes: SlideFlowNode[]
  onElementEdit?: (elementId: string, edit: ElementEdit) => void
}) {
  const editableNodes = useMemo(
    () =>
      initialNodes.map((node) =>
        node.data.kind === 'element'
          ? {
              ...node,
              data: {
                ...node.data,
                commitElementEdit: onElementEdit,
              },
            }
          : node,
      ),
    [initialNodes, onElementEdit],
  )
  const [nodes, , onNodesChange] = useNodesState(editableNodes)

  const handleNodeDragStop: NodeMouseHandler<SlideFlowNode> = (_, node) => {
    if (node.data.kind !== 'element' || node.data.element.kind === 'line') {
      return
    }

    onElementEdit?.(node.id, {
      x: roundCoordinate(node.position.x),
      y: roundCoordinate(node.position.y),
    })
  }

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
      onNodeDragStop={handleNodeDragStop}
      nodesConnectable={false}
      nodesDraggable
      nodeDragThreshold={8}
      noDragClassName="nodrag"
      noPanClassName="nopan"
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

function SlideElementNode({ data, id, selected }: NodeProps<SlideFlowNode>) {
  const reactFlow = useReactFlow<SlideFlowNode>()
  const [isEditingText, setIsEditingText] = useState(false)
  const nodeData = data as SlideElementNodeData

  if (nodeData.kind !== 'element') {
    return null
  }

  const element = nodeData.element
  const canResize = element.kind !== 'line'
  const canEditText = element.kind === 'shape' || element.kind === 'text'
  const commitElementEdit = (edit: ElementEdit) => nodeData.commitElementEdit?.(id, edit)
  const updateElement = (edit: ElementEdit) => {
    reactFlow.setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id || node.data.kind !== 'element') {
          return node
        }

        return {
          ...node,
          data: {
            ...node.data,
            element: applyElementEdit(node.data.element, edit),
          },
          position: {
            x: edit.x ?? node.position.x,
            y: edit.y ?? node.position.y,
          },
          style: {
            ...node.style,
            height: edit.h ?? node.style?.height,
            width: edit.w ?? node.style?.width,
          },
        }
      }),
    )
  }
  const handleTextChange = (text: string) => {
    updateElement({ text })
  }
  const handleTextCommit = (text: string) => {
    setIsEditingText(false)
    updateElement({ text })
    commitElementEdit({ text })
  }
  const handleResize = (
    _: unknown,
    params: { height: number; width: number; x: number; y: number },
  ) => {
    updateElement({
      h: roundCoordinate(params.height),
      w: roundCoordinate(params.width),
      x: roundCoordinate(params.x),
      y: roundCoordinate(params.y),
    })
  }
  const handleResizeEnd = (
    _: unknown,
    params: { height: number; width: number; x: number; y: number },
  ) => {
    commitElementEdit({
      h: roundCoordinate(params.height),
      w: roundCoordinate(params.width),
      x: roundCoordinate(params.x),
      y: roundCoordinate(params.y),
    })
  }

  const controls = canResize ? (
    <NodeResizer
      color="#1451e1"
      handleClassName="slide-flow-resize-handle"
      isVisible={selected}
      lineClassName="slide-flow-resize-line"
      minHeight={24}
      minWidth={36}
      onResize={handleResize}
      onResizeEnd={handleResizeEnd}
    />
  ) : null
  const wrapElement = (content: ReactNode) => (
    <div
      className="slide-flow-element-shell"
      onDoubleClick={canEditText ? () => setIsEditingText(true) : undefined}
    >
      {controls}
      {content}
    </div>
  )

  if (element.kind === 'line') {
    return wrapElement(<SlideLineElement element={element} />)
  }

  if (element.kind === 'text') {
    return wrapElement(
      <SlideTextElement
        element={element}
        isEditable={canEditText && isEditingText}
        onTextChange={handleTextChange}
        onTextCommit={handleTextCommit}
      />,
    )
  }

  if (element.kind === 'image') {
    return wrapElement(
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
      />,
    )
  }

  return wrapElement(
    <SlideShapeElement
      element={element}
      isEditable={canEditText && isEditingText}
      onTextChange={handleTextChange}
      onTextCommit={handleTextCommit}
    />,
  )
}

function SlideShapeElement({
  element,
  isEditable,
  onTextChange,
  onTextCommit,
}: {
  element: NormalizedShapeElement
  isEditable: boolean
  onTextChange: (text: string) => void
  onTextCommit: (text: string) => void
}) {
  const shapeStyle = getSharedBoxStyle(element)
  const textStyle = getTextBoxStyle(element)
  const shouldStackRuns = element.shape === 'rect'
  const label = (
    <SlideTextRuns
      fallbackText={element.label}
      maxStackedFontSizePt={shouldStackRuns ? getMaxStackedFontSizePt(element) : undefined}
      onTextChange={onTextChange}
      onTextCommit={onTextCommit}
      runs={element.textRuns}
      stackVertically={shouldStackRuns}
      text={element.label}
      isEditable={isEditable}
    />
  )

  if (element.shape === 'ellipse') {
    return (
      <SlideSvgShapeFrame
        element={element}
        isEditable={isEditable}
        label={label}
        shapeStyle={shapeStyle}
        textStyle={textStyle}
      >
        <SlideEllipseShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  if (element.shape === 'diamond') {
    return (
      <SlideSvgShapeFrame
        element={element}
        isEditable={isEditable}
        label={label}
        shapeStyle={shapeStyle}
        textStyle={textStyle}
      >
        <SlideDiamondShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  if (element.shape === 'chevron') {
    return (
      <SlideSvgShapeFrame
        element={element}
        isEditable={isEditable}
        label={label}
        shapeStyle={shapeStyle}
        textStyle={textStyle}
      >
        <SlideChevronShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  if (element.shape === 'flowChartMagneticDisk') {
    return (
      <SlideSvgShapeFrame
        element={element}
        isEditable={isEditable}
        label={label}
        shapeStyle={shapeStyle}
        textStyle={textStyle}
      >
        <SlideMagneticDiskShape element={element} />
      </SlideSvgShapeFrame>
    )
  }

  return (
    <SlideRectShape
      element={element}
      isEditable={isEditable}
      label={label}
      shapeStyle={shapeStyle}
      textStyle={getStackedTextBoxStyle(element)}
    />
  )
}

function SlideSvgShapeFrame({
  children,
  element,
  isEditable,
  label,
  shapeStyle,
  textStyle,
}: {
  children: ReactNode
  element: NormalizedShapeElement
  isEditable: boolean
  label: ReactNode
  shapeStyle: CSSProperties
  textStyle: CSSProperties
}) {
  return (
    <div className="slide-flow-shape-node" style={shapeStyle}>
      <svg className="slide-flow-shape-svg" viewBox={`0 0 ${element.w} ${element.h}`}>
        {children}
      </svg>
      <SlideShapeLabel
        className="slide-flow-shape-label"
        element={element}
        isEditable={isEditable}
        label={label}
        style={textStyle}
      />
    </div>
  )
}

function SlideRectShape({
  element,
  isEditable,
  label,
  shapeStyle,
  textStyle,
}: {
  element: NormalizedShapeElement
  isEditable: boolean
  label: ReactNode
  shapeStyle: CSSProperties
  textStyle: CSSProperties
}) {
  return (
    <div className="slide-flow-rect-element" style={{ ...shapeStyle, ...getShapePaintStyle(element) }}>
      <SlideShapeLabel
        className="slide-flow-rect-label"
        element={element}
        isEditable={isEditable}
        label={label}
        style={textStyle}
      />
    </div>
  )
}

function SlideShapeLabel({
  className,
  element,
  isEditable,
  label,
  style,
}: {
  className: string
  element: NormalizedShapeElement
  isEditable: boolean
  label: ReactNode
  style: CSSProperties
}) {
  if (!isEditable && !element.label.trim()) {
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

function SlideTextElement({
  element,
  isEditable,
  onTextChange,
  onTextCommit,
}: {
  element: NormalizedTextElement
  isEditable: boolean
  onTextChange: (text: string) => void
  onTextCommit: (text: string) => void
}) {
  const paintStyle = getTextPaintStyle(element)
  const textStyle = getTextBoxStyle(element)

  return (
    <div
      className="slide-flow-text-element"
      style={{
        ...getSharedBoxStyle(element),
        ...paintStyle,
        ...(isEditable ? undefined : textStyle),
      }}
    >
      <SlideTextRuns
        fallbackText={element.text}
        isEditable={isEditable}
        onTextChange={onTextChange}
        onTextCommit={onTextCommit}
        runs={element.runs}
        text={element.text}
        textStyle={textStyle}
      />
    </div>
  )
}

function SlideLineElement({ element }: { element: NormalizedLineElement }) {
  const originX = Math.min(element.x1, element.x2)
  const originY = Math.min(element.y1, element.y2)
  const width = Math.max(Math.abs(element.x2 - element.x1), Math.max(element.strokeWidth, 1))
  const height = Math.max(Math.abs(element.y2 - element.y1), Math.max(element.strokeWidth, 1))
  const x1 = element.x1 <= element.x2 ? 0 : width
  const x2 = element.x1 <= element.x2 ? width : 0
  const y1 = element.y1 <= element.y2 ? 0 : height
  const y2 = element.y1 <= element.y2 ? height : 0
  const hasEndArrow = element.endArrow !== 'none'
  const markerId = `${element.id}-arrow`
  const maskId = `${element.id}-occlusion-mask`
  const hasOcclusionMask = element.occlusionRects.length > 0

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
      <SlideLineOcclusionMask
        height={height}
        id={maskId}
        isVisible={hasOcclusionMask}
        originX={originX}
        originY={originY}
        rects={element.occlusionRects}
        width={width}
      />
      <line
        x1={x1}
        x2={x2}
        y1={y1}
        y2={y2}
        mask={hasOcclusionMask ? `url(#${maskId})` : undefined}
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

function SlideLineOcclusionMask({
  height,
  id,
  isVisible,
  originX,
  originY,
  rects,
  width,
}: {
  height: number
  id: string
  isVisible: boolean
  originX: number
  originY: number
  rects: NormalizedLineElement['occlusionRects']
  width: number
}) {
  if (!isVisible) {
    return null
  }

  const occlusionPadding = 1.5

  return (
    <defs>
      <mask height={8192} id={id} maskUnits="userSpaceOnUse" width={8192} x={-4096} y={-4096}>
        <rect fill="white" height={height} width={width} x={0} y={0} />
        {rects.map((rect, index) => (
          <rect
            fill="black"
            height={rect.h + occlusionPadding * 2}
            key={`${index}-${rect.x}-${rect.y}`}
            width={rect.w + occlusionPadding * 2}
            x={rect.x - originX - occlusionPadding}
            y={rect.y - originY - occlusionPadding}
          />
        ))}
      </mask>
    </defs>
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
  isEditable = false,
  maxStackedFontSizePt,
  onTextChange,
  onTextCommit,
  runs,
  stackVertically = false,
  text,
  textStyle,
}: {
  fallbackText: string
  isEditable?: boolean
  maxStackedFontSizePt?: number
  onTextChange?: (text: string) => void
  onTextCommit?: (text: string) => void
  runs: NormalizedTextRun[]
  stackVertically?: boolean
  text?: string
  textStyle?: CSSProperties
}) {
  if (isEditable) {
    return (
      <EditableNodeText
        onTextChange={onTextChange}
        onTextCommit={onTextCommit}
        text={text ?? fallbackText}
        textStyle={textStyle}
      />
    )
  }

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

function EditableNodeText({
  onTextChange,
  onTextCommit,
  text,
  textStyle,
}: {
  onTextChange?: (text: string) => void
  onTextCommit?: (text: string) => void
  text: string
  textStyle?: CSSProperties
}) {
  const [draft, setDraft] = useState(text)
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.currentTarget.value)
    onTextChange?.(event.currentTarget.value)
  }
  const handleBlur = () => {
    onTextCommit?.(draft)
  }

  return (
    <textarea
      aria-label="Edit node text"
      className="slide-flow-editable-text nodrag nopan"
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(event) => event.stopPropagation()}
      spellCheck={false}
      style={textStyle}
      value={draft}
    />
  )
}

function applyElementEditToInput(input: unknown, elementId: string, edit: ElementEdit) {
  const nextInput = cloneJsonValue(input)

  updateRawElementById(nextInput, elementId, edit)

  return nextInput
}

function updateRawElementById(value: unknown, elementId: string, edit: ElementEdit): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => updateRawElementById(item, elementId, edit))
  }

  if (!isRecord(value)) {
    return false
  }

  if (value.id === elementId) {
    applyRawElementEdit(value, edit)
    return true
  }

  return Object.values(value).some((item) => updateRawElementById(item, elementId, edit))
}

function applyRawElementEdit(element: Record<string, unknown>, edit: ElementEdit) {
  if (edit.x !== undefined) {
    element.x = edit.x
    if ('left' in element) {
      element.left = edit.x
    }
  }

  if (edit.y !== undefined) {
    element.y = edit.y
    if ('top' in element) {
      element.top = edit.y
    }
  }

  if (edit.w !== undefined) {
    element.w = edit.w
    if ('width' in element) {
      element.width = edit.w
    }
  }

  if (edit.h !== undefined) {
    element.h = edit.h
    if ('height' in element) {
      element.height = edit.h
    }
  }

  if (edit.text !== undefined) {
    element.text = edit.text
    if ('label' in element) {
      element.label = edit.text
    }
    element.runs = buildRawTextRuns(element, edit.text)
  }
}

function applyElementEdit(
  element: SlideElementNodeData['element'],
  edit: ElementEdit,
): SlideElementNodeData['element'] {
  if (element.kind === 'line') {
    return element
  }

  const geometryEdit = {
    ...(edit.h !== undefined ? { h: edit.h } : undefined),
    ...(edit.w !== undefined ? { w: edit.w } : undefined),
    ...(edit.x !== undefined ? { x: edit.x } : undefined),
    ...(edit.y !== undefined ? { y: edit.y } : undefined),
  }

  if (element.kind === 'image') {
    return {
      ...element,
      ...geometryEdit,
    }
  }

  if (element.kind === 'text') {
    const text = edit.text ?? element.text

    return {
      ...element,
      ...geometryEdit,
      ...(edit.text !== undefined
        ? {
            runs: buildNormalizedTextRuns(element, text),
            text,
          }
        : undefined),
    }
  }

  const text = edit.text ?? element.label

  return {
    ...element,
    ...geometryEdit,
    ...(edit.text !== undefined
      ? {
          label: text,
          textRuns: buildNormalizedTextRuns(element, text),
        }
      : undefined),
  }
}

function buildNormalizedTextRuns(
  element: NormalizedShapeElement | NormalizedTextElement,
  text: string,
): NormalizedTextRun[] {
  const firstRun = element.kind === 'shape' ? element.textRuns[0] : element.runs[0]
  const lines = text.split('\n')

  return lines.map((line, index) => ({
    bold: firstRun?.bold ?? element.bold,
    breakLine: index < lines.length - 1,
    color: firstRun?.color ?? ('color' in element ? element.color : element.textColor),
    fontFace: firstRun?.fontFace ?? element.fontFace,
    fontSize: firstRun?.fontSize ?? element.fontSize,
    italic: firstRun?.italic ?? ('italic' in element ? element.italic : false),
    text: line,
    underline: firstRun?.underline ?? false,
  }))
}

function buildRawTextRuns(element: Record<string, unknown>, text: string) {
  const existingRuns = Array.isArray(element.runs) ? element.runs.filter(isRecord) : []
  const firstRun = existingRuns[0]
  const lines = text.split('\n')
  const color = asString(firstRun?.color) || asString(element.textColor) || asString(element.color)
  const fontFace = asString(firstRun?.fontFace) || asString(element.fontFace)
  const fontSize = asNumber(firstRun?.fontSize) ?? asNumber(element.fontSize)
  const bold = asBoolean(firstRun?.bold) ?? asBoolean(element.bold)
  const italic = asBoolean(firstRun?.italic) ?? asBoolean(element.italic)
  const underline = asBoolean(firstRun?.underline)

  return lines.map((line, index) => ({
    ...(bold !== undefined ? { bold } : undefined),
    breakLine: index < lines.length - 1,
    ...(color ? { color } : undefined),
    ...(fontFace ? { fontFace } : undefined),
    ...(fontSize !== undefined ? { fontSize } : undefined),
    ...(italic !== undefined ? { italic } : undefined),
    text: line,
    ...(underline !== undefined ? { underline } : undefined),
  }))
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)]),
    ) as T
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
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
