import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Background, ConnectionLineType, Controls, Handle, MiniMap, Position, ReactFlow } from '@xyflow/react'
import type { Edge, NodeProps } from '@xyflow/react'

import { JsonEditorPanel } from './JsonEditorPanel'
import { MetadataPanel } from './MetadataPanel'
import { DEFAULT_EDGE_OPTIONS } from '../lib/diagram'
import { useDiagramFlow } from '../hooks/useDiagramFlow'
import type { DiagramNode, DiagramNodeData } from '../lib/diagram'
import type { PromptOutput } from '../types/PromptOutput'

type DiagramCanvasProps = {
  message: string
  onBack: () => void
  onUpdateMessage: (value: string) => void
  promptOutput: PromptOutput
}

type PanelMode = 'prompt' | 'metadata' | null

type JsonPosition = {
  x: number
  y: number
}

type JsonDimensions = {
  height: number | null
  width: number | null
}

type EditableNodeJson = {
  data: DiagramNodeData
  height: number | null
  id: string
  position: JsonPosition
  width: number | null
}

type EditableEdgeJson = Edge & {
  sourceDimensions?: JsonDimensions
  sourcePosition?: JsonPosition
  targetDimensions?: JsonDimensions
  targetPosition?: JsonPosition
}

const NODE_TYPES = {
  default: EditableDiagramNode,
}

function toNumericDimension(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function readNodeDimension(node: DiagramNode, dimension: 'height' | 'width') {
  return (
    toNumericDimension(node.measured?.[dimension]) ??
    toNumericDimension(node[dimension]) ??
    toNumericDimension(node.style?.[dimension]) ??
    null
  )
}

function readNodeDimensions(node: DiagramNode): JsonDimensions {
  return {
    width: readNodeDimension(node, 'width'),
    height: readNodeDimension(node, 'height'),
  }
}

function formatNodeData(nodes: DiagramNode[]) {
  return JSON.stringify(
    nodes.map((node) => ({
      id: node.id,
      position: node.position,
      width: readNodeDimension(node, 'width'),
      height: readNodeDimension(node, 'height'),
      data: node.data,
    } satisfies EditableNodeJson)),
    null,
    2,
  )
}

function formatEdgeData(edges: Edge[], nodes: DiagramNode[]) {
  const positionByNodeId = new Map(nodes.map((node) => [node.id, node.position]))
  const dimensionsByNodeId = new Map(nodes.map((node) => [node.id, readNodeDimensions(node)]))

  return JSON.stringify(
    edges.map((edge) => ({
      ...edge,
      sourcePosition: positionByNodeId.get(edge.source),
      sourceDimensions: dimensionsByNodeId.get(edge.source),
      targetPosition: positionByNodeId.get(edge.target),
      targetDimensions: dimensionsByNodeId.get(edge.target),
    } satisfies EditableEdgeJson)),
    null,
    2,
  )
}

function isJsonPosition(value: unknown): value is JsonPosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    typeof value.x === 'number' &&
    'y' in value &&
    typeof value.y === 'number'
  )
}

function isEditableNodeData(value: unknown): value is DiagramNodeData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    typeof value.label === 'string' &&
    'metadata' in value &&
    typeof value.metadata === 'object' &&
    value.metadata !== null &&
    'dependencies' in value.metadata &&
    Array.isArray(value.metadata.dependencies) &&
    'summary' in value.metadata &&
    typeof value.metadata.summary === 'string' &&
    'system' in value.metadata &&
    typeof value.metadata.system === 'string'
  )
}

function isEditableDimension(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isEditableNodeJsonArray(value: unknown): value is EditableNodeJson[] {
  return (
    Array.isArray(value) &&
    value.every((item) => (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'string' &&
      'position' in item &&
      isJsonPosition(item.position) &&
      'width' in item &&
      isEditableDimension(item.width) &&
      'height' in item &&
      isEditableDimension(item.height) &&
      'data' in item &&
      isEditableNodeData(item.data)
    ))
  )
}

function isEditableEdgeArray(value: unknown): value is Edge[] {
  return (
    Array.isArray(value) &&
    value.every((item) => (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'string' &&
      'source' in item &&
      typeof item.source === 'string' &&
      'target' in item &&
      typeof item.target === 'string'
    ))
  )
}

function isCylinderNodeData(data: DiagramNodeData) {
  return data.shape === 'cylinder' || (Array.isArray(data.metadata.tags) && data.metadata.tags.some((tag) => tag.toLowerCase() === 'cylinder'))
}

function EditableDiagramNode({ data }: NodeProps<DiagramNode>) {
  if (isCylinderNodeData(data)) {
    return (
      <div className="database-node">
        <div className="top" />
        <div className="body">
          <div>{data.label}</div>
          {data.subtext ? (
            <div className="font-serif text-xs font-normal leading-snug opacity-80">
              {data.subtext}
            </div>
          ) : null}
        </div>
        <div className="bottom" />

        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    )
  }

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div className="grid gap-1">
        <div>{data.label}</div>
        {data.subtext ? (
          <div className="font-serif text-xs font-normal leading-snug opacity-80">
            {data.subtext}
          </div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  )
}

type DockButtonProps = {
  active?: boolean
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
}

function getDockButtonClassName({ active = false, iconOnly = false }: {
  active?: boolean
  iconOnly?: boolean
}) {
  return [
    iconOnly
      ? 'grid h-[3.25rem] w-[3.25rem] place-items-center p-0'
      : 'h-[3.25rem] px-5 text-sm font-semibold',
    'cursor-pointer rounded-full border border-[#171717]/8 bg-gradient-to-br from-[#f26f21] to-[#c95518] text-white shadow-[0_14px_28px_rgba(242,111,33,0.28)] transition duration-150 ease-out hover:-translate-y-px',
    iconOnly && 'disabled:cursor-not-allowed disabled:border-[#171717]/6 disabled:from-[#bdbdbd] disabled:to-[#8f8f8f] disabled:shadow-none disabled:transform-none',
    active && 'ring-2 ring-[#171717]/12 ring-offset-2 ring-offset-white',
  ]
    .filter(Boolean)
    .join(' ')
}

function DockButton({ active = false, children, disabled, label, onClick }: DockButtonProps) {
  return (
    <button
      type="button"
      className={getDockButtonClassName({ active, iconOnly: true })}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <span className="inline-flex h-[1.35rem] w-[1.35rem]" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}

type DockTextButtonProps = {
  active?: boolean
  children: ReactNode
  label: string
  onClick: () => void
}

function DockTextButton({ active = false, children, label, onClick }: DockTextButtonProps) {
  return (
    <button
      type="button"
      className={getDockButtonClassName({ active })}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </button>
  )
}

export function DiagramCanvas({
  message,
  onBack,
  onUpdateMessage,
  promptOutput,
}: DiagramCanvasProps) {
  const [activePanel, setActivePanel] = useState<PanelMode>(null)
  const [isDiagramStudioVisible, setIsDiagramStudioVisible] = useState(false)
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectedNodes, setEdges, setNodes } = useDiagramFlow({
    promptOutput,
  })
  const [nodeJsonValue, setNodeJsonValue] = useState(() => formatNodeData(nodes))
  const [nodeJsonError, setNodeJsonError] = useState<string | null>(null)
  const [edgeJsonValue, setEdgeJsonValue] = useState(() => formatEdgeData(edges, nodes))
  const [edgeJsonError, setEdgeJsonError] = useState<string | null>(null)
  const [flowRenderKey, setFlowRenderKey] = useState(0)

  useMemo(() => {
    setNodeJsonValue(formatNodeData(nodes))
    setEdgeJsonValue(formatEdgeData(edges, nodes))
  }, [edges, nodes])

  const closePanel = () => setActivePanel(null)
  const openMetadataPanel = () => setActivePanel('metadata')
  const openPromptPanel = () => setActivePanel('prompt')
  const toggleDiagramStudio = () => setIsDiagramStudioVisible((isVisible) => !isVisible)
  const isPanelVisible = activePanel !== null

  const applyNodeJsonToFlow = (value: string) => {
    try {
      const parsedValue: unknown = JSON.parse(value)

      if (!isEditableNodeJsonArray(parsedValue)) {
        setNodeJsonError('JSON must be an array of node objects with id, position.x/y, width, height, and data.')
        return false
      }

      if (parsedValue.length !== nodes.length) {
        setNodeJsonError(`Expected ${nodes.length} node data objects, but found ${parsedValue.length}.`)
        return false
      }

      setNodeJsonError(null)

      setNodes((currentNodes) => (
        currentNodes.map((node, index) => {
          const editedNode = parsedValue.find((item) => item.id === node.id) ?? parsedValue[index]

          return {
            ...node,
            data: editedNode.data,
            position: editedNode.position,
            style: {
              ...node.style,
              ...(editedNode.width === null ? {} : { width: editedNode.width }),
              ...(editedNode.height === null ? {} : { height: editedNode.height }),
            },
          }
        })
      ))
      return true
    } catch (error) {
      setNodeJsonError(error instanceof Error ? error.message : 'Invalid JSON.')
      return false
    }
  }

  const applyEdgeJsonToFlow = (value: string) => {
    try {
      const parsedValue: unknown = JSON.parse(value)

      if (!isEditableEdgeArray(parsedValue)) {
        setEdgeJsonError('JSON must be an array of edges with id, source, and target.')
        return false
      }

      setEdgeJsonError(null)
      setEdges(parsedValue.map(({
        sourceDimensions,
        sourcePosition,
        targetDimensions,
        targetPosition,
        ...edge
      }) => edge))
      return true
    } catch (error) {
      setEdgeJsonError(error instanceof Error ? error.message : 'Invalid JSON.')
      return false
    }
  }

  const handleNodeJsonChange = (value: string) => {
    setNodeJsonValue(value)
    applyNodeJsonToFlow(value)
  }

  const handleEdgeJsonChange = (value: string) => {
    setEdgeJsonValue(value)
    applyEdgeJsonToFlow(value)
  }

  return (
    <main className="h-screen min-h-screen overflow-hidden p-0">
      <div
        className={[
          'grid min-h-screen h-screen grid-cols-1',
          isPanelVisible ? 'min-[881px]:grid-cols-[minmax(0,1fr)_380px]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <section
          className={[
            'grid min-h-0 h-full overflow-hidden [&_.react-flow]:bg-[radial-gradient(circle_at_top_left,rgba(242,111,33,0.12),transparent_20%),linear-gradient(180deg,#ffffff_0%,#f6f6f6_100%)] [&_.react-flow__node.selected]:shadow-[0_0_0_3px_rgba(242,111,33,0.26)] [&_.react-flow__controls-button]:border-[#171717]/10 [&_.react-flow__controls-button]:bg-white/96 [&_.react-flow__controls-button]:text-[#171717] [&_.react-flow__minimap]:rounded-2xl [&_.react-flow__minimap]:border [&_.react-flow__minimap]:border-[#171717]/10 [&_.react-flow__minimap]:bg-white/92',
            isDiagramStudioVisible ? 'grid-cols-[minmax(36rem,48rem)_minmax(0,1fr)]' : 'grid-cols-1',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isDiagramStudioVisible && (
            <aside className="grid min-h-0 grid-cols-2 border-r border-[#171717]/10 bg-white">
              <div className="grid min-h-0 grid-rows-[auto_1fr_auto_auto] border-r border-[#171717]/10">
                <h2 className="m-0 border-b border-[#171717]/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#171717]/60">
                  Nodes + Coordinates
                </h2>
                <textarea
                  className="min-h-0 w-full resize-none border-0 bg-white p-4 font-mono text-xs leading-relaxed text-[#171717] outline-none"
                  value={nodeJsonValue}
                  onChange={(event) => handleNodeJsonChange(event.target.value)}
                  aria-label="Editable node JSON with x and y coordinates"
                  spellCheck={false}
                />
                {nodeJsonError && (
                  <p className="m-0 border-t border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                    {nodeJsonError}
                  </p>
                )}
              </div>

              <div className="grid min-h-0 grid-rows-[auto_1fr_auto]">
                <h2 className="m-0 border-b border-[#171717]/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#171717]/60">
                  Edges + Coordinates
                </h2>
                <textarea
                  className="min-h-0 w-full resize-none border-0 bg-white p-4 font-mono text-xs leading-relaxed text-[#171717] outline-none"
                  value={edgeJsonValue}
                  onChange={(event) => handleEdgeJsonChange(event.target.value)}
                  aria-label="Editable edge JSON with source and target x and y coordinates"
                  spellCheck={false}
                />
                {edgeJsonError && (
                  <p className="m-0 border-t border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                    {edgeJsonError}
                  </p>
                )}
              </div>
            </aside>
          )}

          <div className="min-h-0 min-w-0">
            <ReactFlow
              key={flowRenderKey}
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              connectionLineType={ConnectionLineType.Step}
              proOptions={{ hideAttribution: true }}
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background gap={24} size={1} color="#d7d7d7" />
            </ReactFlow>
          </div>
        </section>

        {activePanel === 'prompt' && (
          <JsonEditorPanel
            value={message}
            onClose={closePanel}
            onSave={onUpdateMessage}
          />
        )}

        {activePanel === 'metadata' && (
          <MetadataPanel nodes={selectedNodes} onClose={closePanel} />
        )}
      </div>

      <nav
        className="fixed bottom-[1.1rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#171717]/10 bg-white/92 p-3 shadow-[0_24px_80px_rgba(23,23,23,0.14)] backdrop-blur-xl max-[640px]:bottom-[0.85rem]"
        aria-label="Canvas controls"
      >
        <DockButton label="Back to prompt" onClick={onBack}>
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            className="h-full w-full fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
          >
            <path d="M14 6 8 12l6 6" />
            <path d="M9 12h7" />
          </svg>
        </DockButton>

        <DockButton
          label="Open submitted prompt"
          onClick={openPromptPanel}
          active={activePanel === 'prompt'}
        >
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            className="h-full w-full fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
          >
            <path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 7 20V5a1.5 1.5 0 0 1 1-1.5Z" />
            <path d="M14 3.5V8h4" />
            <path d="M10 12h4" />
            <path d="M10 16h4" />
          </svg>
        </DockButton>

        <DockTextButton
          label="Diagram Studio"
          onClick={toggleDiagramStudio}
          active={isDiagramStudioVisible}
        >
          Diagram Studio
        </DockTextButton>

        <DockButton
          label="Open selected node metadata"
          onClick={openMetadataPanel}
          disabled={selectedNodes.length === 0}
          active={activePanel === 'metadata'}
        >
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            className="h-full w-full fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M12 10v5" />
            <path d="M12 7.5h.01" />
          </svg>
        </DockButton>
      </nav>
    </main>
  )
}
