import { MarkerType } from '@xyflow/react'
import type { DefaultEdgeOptions, Edge, Node } from '@xyflow/react'

import type {
  PromptOutput,
  PromptOutputChildNode,
  PromptOutputLeafNode,
  PromptOutputParentMetadata,
  PromptOutputParentMetadataValue,
  PromptOutputRelationshipType,
  PromptOutputShape,
} from '../types/PromptOutput'

export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'md',
  'markdown',
  'txt',
  'rtf',
])

export const ACCEPT_ATTR = [
  '.ppt',
  '.rtf',
  '.pdf',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.md',
  '.markdown',
  '.txt',
  'text/plain',
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

export const FILTERS = ['Microservices', 'Event-Driven', 'Serverless', 'Data Flow', 'Security Zones']

export type NodeMetadata = {
  dependencies: string[]
  environment: string
  lastDeployed: string
  layerMetadata?: PromptOutputParentMetadata
  owner: string
  region: string
  runtime: string
  sla: string
  summary: string
  system: string
  tags: string[]
}

export type DiagramNodeData = {
  label: string
  metadata: NodeMetadata
}

export type DiagramNode = Node<DiagramNodeData>

export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  animated: true,
  type: 'smoothstep',
  pathOptions: { borderRadius: 0, offset: 18 },
  markerEnd: { type: MarkerType.ArrowClosed },
}

const LEFT_COLUMN_X = 120
const RIGHT_COLUMN_X = 860
const COLUMN_GAP_X = 72
const COLUMN_TOP_Y = 20
const COLUMN_GAP_Y = 26

const PARENT_HEADER_OFFSET_Y = 50
const PARENT_PADDING_X = 16
const PARENT_PADDING_BOTTOM = 16
const CHILD_VERTICAL_GAP = 10
const CHILD_HORIZONTAL_GAP = 14
const CHILD_CONTAINER_HEADER_OFFSET_Y = 44
const CHILD_CONTAINER_PADDING_X = 14
const CHILD_CONTAINER_PADDING_BOTTOM = 14

const PRIMARY_PARENT_MIN_WIDTH = 680
const SECONDARY_PARENT_MIN_WIDTH = 500
const PRIMARY_PARENT_MIN_HEIGHT = 250
const SECONDARY_PARENT_MIN_HEIGHT = 200

const SHAPE_DIMENSIONS: Record<PromptOutputShape, { height: number; width: number }> = {
  rectangle: { width: 470, height: 94 },
  cylinder: { width: 130, height: 88 },
  label: { width: 150, height: 34 },
}

const EDGE_STYLES: Record<PromptOutputRelationshipType, { animated: boolean; stroke: string }> = {
  flow: { stroke: '#64748b', animated: true },
  api: { stroke: '#2563eb', animated: true },
  data: { stroke: '#475569', animated: false },
  queue: { stroke: '#b45309', animated: true },
  analytics: { stroke: '#7c3aed', animated: true },
}

function createNode(
  id: string,
  label: string,
  position: { x: number; y: number },
  className: string,
  metadata: NodeMetadata,
  options: Partial<Pick<DiagramNode, 'extent' | 'parentId' | 'style' | 'type'>> = {},
): DiagramNode {
  const normalizedLabel = normalizeNodeLabel(label)

  return {
    id,
    position,
    data: { label: normalizedLabel, metadata },
    className,
    ...options,
  }
}

function normalizeNodeLabel(label: string) {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ')

  if (normalized === 'repository layer') {
    return 'Data Layer'
  }

  return label
}

function getParentClassName() {
  return [
    '!rounded-[6px]',
    '!border',
    '!border-slate-300',
    '!bg-slate-300',
    '!px-3',
    '!py-2',
    '!text-center',
    '!font-bold',
    '!text-[#060150]',
    '!shadow-none',
  ].join(' ')
}

function getChildClassName(shape: PromptOutputShape, isContainer = false) {
  if (shape === 'label') {
    return [
      !isContainer ? '!w-[150px]' : '',
      '!border-0',
      '!bg-transparent',
      '!px-0',
      '!py-0',
      '!text-center',
      '!font-semibold',
      '!text-base',
      '!text-[#060150]',
      '!shadow-none',
    ].join(' ')
  }

  if (shape === 'cylinder') {
    return [
      'rf-cylinder-node',
      !isContainer ? '!w-[130px]' : '',
      '!px-3',
      '!pt-6',
      '!pb-4',
      '!text-center',
      '!font-semibold',
    ].join(' ')
  }

  return [
    !isContainer ? '!w-[470px]' : '',
    '!rounded-[4px]',
    '!border-[2px]',
    '!border-[#060150]',
    '!bg-[#060150]',
    isContainer ? '!pt-3 !pb-4 !px-3' : '!py-3 !px-3',
    '!text-center',
    '!font-semibold',
    '!text-white',
    '!shadow-none',
  ].join(' ')
}

function getNodeDimensions(shape: PromptOutputShape) {
  return SHAPE_DIMENSIONS[shape]
}

function collectLabelsFromChildren(
  children: Array<PromptOutputChildNode | PromptOutputLeafNode>,
  labels: Map<string, string>,
) {
  for (const child of children) {
    labels.set(child.id, normalizeNodeLabel(child.label))

    if ('children' in child) {
      const nestedChildren = child.children
      if (nestedChildren && nestedChildren.length > 0) {
        collectLabelsFromChildren(nestedChildren, labels)
      }
    }
  }
}

function collectNodeLabels(promptOutput: PromptOutput) {
  const labels = new Map<string, string>()

  for (const parent of promptOutput.diagram.parents) {
    labels.set(parent.id, normalizeNodeLabel(parent.label))
    collectLabelsFromChildren(parent.children, labels)
  }

  return labels
}

function collectDependenciesBySource(promptOutput: PromptOutput, labelById: Map<string, string>) {
  const dependencyMap = new Map<string, string[]>()

  for (const edge of promptOutput.diagram.edges) {
    const dependencyLabel = labelById.get(edge.target)

    if (!dependencyLabel) {
      continue
    }

    const current = dependencyMap.get(edge.source)

    if (!current) {
      dependencyMap.set(edge.source, [dependencyLabel])
      continue
    }

    if (!current.includes(dependencyLabel)) {
      current.push(dependencyLabel)
    }
  }

  return dependencyMap
}

function toMetadataText(value: PromptOutputParentMetadataValue | undefined) {
  if (value === undefined) {
    return ''
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

function readMetadataField(
  metadataByNormalizedKey: Map<string, PromptOutputParentMetadataValue>,
  keys: string[],
  fallback: string,
) {
  for (const key of keys) {
    const value = metadataByNormalizedKey.get(key)
    const text = toMetadataText(value)
    if (text) {
      return text
    }
  }

  return fallback
}

function normalizeMetadataValues(metadata: PromptOutputParentMetadata) {
  const metadataByNormalizedKey = new Map<string, PromptOutputParentMetadataValue>()
  for (const [key, value] of Object.entries(metadata)) {
    metadataByNormalizedKey.set(key.toLowerCase(), value)
  }

  return metadataByNormalizedKey
}

function buildMetadataTags(metadata: PromptOutputParentMetadata) {
  return metadata.tags
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .filter((tag) => tag.length > 0)
}

function buildParentMetadata(
  parentLabel: string,
  parentMetadata: PromptOutputParentMetadata,
  dependencies: string[],
): NodeMetadata {
  const metadataByNormalizedKey = normalizeMetadataValues(parentMetadata)

  const summary = readMetadataField(
    metadataByNormalizedKey,
    ['summary', 'description'],
    `${parentLabel} section containing related architecture components.`,
  )

  const metadataTags = buildMetadataTags(parentMetadata)

  return {
    dependencies,
    environment: readMetadataField(
      metadataByNormalizedKey,
      ['environment', 'environments'],
      'Architecture Diagram',
    ),
    lastDeployed: readMetadataField(
      metadataByNormalizedKey,
      ['lastdeployed', 'last_deployed', 'deployment', 'deployedat'],
      'N/A',
    ),
    layerMetadata: parentMetadata,
    owner: readMetadataField(
      metadataByNormalizedKey,
      ['owner', 'team'],
      'System Design',
    ),
    region: readMetadataField(
      metadataByNormalizedKey,
      ['region', 'regions'],
      'N/A',
    ),
    runtime: readMetadataField(
      metadataByNormalizedKey,
      ['runtime', 'languages', 'language', 'stack', 'frameworks'],
      'N/A',
    ),
    sla: readMetadataField(
      metadataByNormalizedKey,
      ['sla', 'availability'],
      'N/A',
    ),
    summary,
    system: parentLabel,
    tags: ['group', 'section', ...metadataTags],
  }
}

function buildChildMetadata(
  node: PromptOutputLeafNode,
  parentLabel: string,
  dependencies: string[],
): NodeMetadata {
  const nodeMetadata = node.metadata
  const metadataByNormalizedKey = normalizeMetadataValues(nodeMetadata)
  const metadataTags = buildMetadataTags(nodeMetadata)

  return {
    dependencies,
    environment: readMetadataField(
      metadataByNormalizedKey,
      ['environment', 'environments'],
      'Architecture Diagram',
    ),
    lastDeployed: readMetadataField(
      metadataByNormalizedKey,
      ['lastdeployed', 'last_deployed', 'deployment', 'deployedat'],
      'N/A',
    ),
    layerMetadata: nodeMetadata,
    owner: readMetadataField(
      metadataByNormalizedKey,
      ['owner', 'team'],
      node.deployment || 'Unspecified',
    ),
    region: readMetadataField(
      metadataByNormalizedKey,
      ['region', 'regions'],
      'N/A',
    ),
    runtime: readMetadataField(
      metadataByNormalizedKey,
      ['runtime', 'languages', 'language', 'stack', 'frameworks'],
      node.technology || 'Unspecified',
    ),
    sla: readMetadataField(
      metadataByNormalizedKey,
      ['sla', 'availability'],
      'N/A',
    ),
    summary: readMetadataField(
      metadataByNormalizedKey,
      ['summary', 'description'],
      node.subtitle || `${node.label} component in ${parentLabel}.`,
    ),
    system: readMetadataField(
      metadataByNormalizedKey,
      ['system', 'domain'],
      parentLabel,
    ),
    tags: [node.shape, node.nodeType, ...metadataTags],
  }
}

type LayoutResult = {
  maxRight: number
  nextY: number
  nodes: DiagramNode[]
  rowLayout: boolean
}

type ChildLayoutResult = {
  height: number
  isSharedLayerCandidate: boolean
  nodes: DiagramNode[]
  width: number
}

function isLayerContainer(label: string) {
  return /\blayer\b/i.test(label)
}

function shouldLayoutChildrenInRow({
  children,
  containerLabel,
}: {
  children: Array<PromptOutputChildNode | PromptOutputLeafNode>
  containerLabel: string
}) {
  if (children.length < 2) {
    return false
  }

  return isLayerContainer(containerLabel)
}

function shouldShareWidthWithPeerLayers(child: PromptOutputChildNode | PromptOutputLeafNode) {
  return child.shape === 'rectangle' && isLayerContainer(child.label)
}

function layoutChildSubtree({
  child,
  dependenciesBySource,
  forcedWidth,
  parentId,
  parentLabel,
  relativePosition,
}: {
  child: PromptOutputChildNode | PromptOutputLeafNode
  dependenciesBySource: Map<string, string[]>
  forcedWidth?: number
  parentId: string
  parentLabel: string
  // Child coordinates are relative to the parent container when parentId is set.
  relativePosition: { x: number; y: number }
}): ChildLayoutResult {
  const { height: baseHeight, width: baseWidth } = getNodeDimensions(child.shape)
  const nestedChildren = 'children' in child ? child.children : undefined
  const hasNestedChildren = Boolean(nestedChildren && nestedChildren.length > 0)
  let width = baseWidth
  let height = baseHeight
  let nestedNodes: DiagramNode[] = []

  if (hasNestedChildren && nestedChildren) {
    let nestedLayout = layoutChildren({
      children: nestedChildren,
      containerLabel: child.label,
      dependenciesBySource,
      parentId: child.id,
      parentLabel,
      relativeStartX: CHILD_CONTAINER_PADDING_X,
      relativeStartY: CHILD_CONTAINER_HEADER_OFFSET_Y,
    })

    const intrinsicWidth = Math.max(baseWidth, nestedLayout.maxRight + CHILD_CONTAINER_PADDING_X)
    width = Math.max(intrinsicWidth, forcedWidth ?? intrinsicWidth)

    if (forcedWidth !== undefined && forcedWidth > intrinsicWidth && nestedLayout.rowLayout) {
      const nestedContentWidth = Math.max(0, nestedLayout.maxRight - CHILD_CONTAINER_PADDING_X)
      const availableInnerWidth = Math.max(0, forcedWidth - (CHILD_CONTAINER_PADDING_X * 2))
      const centeredStartX =
        CHILD_CONTAINER_PADDING_X + Math.max(0, (availableInnerWidth - nestedContentWidth) / 2)

      nestedLayout = layoutChildren({
        children: nestedChildren,
        containerLabel: child.label,
        dependenciesBySource,
        parentId: child.id,
        parentLabel,
        relativeStartX: centeredStartX,
        relativeStartY: CHILD_CONTAINER_HEADER_OFFSET_Y,
      })
    }

    height = Math.max(baseHeight, nestedLayout.nextY + CHILD_CONTAINER_PADDING_BOTTOM)
    nestedNodes = nestedLayout.nodes
  } else {
    width = Math.max(baseWidth, forcedWidth ?? baseWidth)
  }

  const metadata = buildChildMetadata(
    child,
    parentLabel,
    dependenciesBySource.get(child.id) ?? [],
  )

  const childNode = createNode(
    child.id,
    child.label,
    relativePosition,
    getChildClassName(child.shape, hasNestedChildren),
    metadata,
    {
      extent: 'parent',
      parentId,
      style: hasNestedChildren || forcedWidth !== undefined
        ? {
            width,
            ...(hasNestedChildren ? { height } : {}),
          }
        : undefined,
    },
  )

  return {
    width,
    height,
    isSharedLayerCandidate: shouldShareWidthWithPeerLayers(child),
    nodes: [childNode, ...nestedNodes],
  }
}

function layoutChildren({
  children,
  containerLabel,
  dependenciesBySource,
  parentId,
  parentLabel,
  relativeStartX,
  relativeStartY,
}: {
  children: Array<PromptOutputChildNode | PromptOutputLeafNode>
  containerLabel: string
  dependenciesBySource: Map<string, string[]>
  parentId: string
  parentLabel: string
  // Start coordinates are relative to the current parent node/container.
  relativeStartX: number
  relativeStartY: number
}): LayoutResult {
  const nodes: DiagramNode[] = []
  const rowLayout = shouldLayoutChildrenInRow({ children, containerLabel })
  let cursorY = relativeStartY
  let cursorX = relativeStartX
  let maxRight = 0
  let maxBottom = relativeStartY

  if (!rowLayout) {
    const preliminaryLayouts = children.map((child) => layoutChildSubtree({
      child,
      dependenciesBySource,
      parentId,
      parentLabel,
      relativePosition: { x: 0, y: 0 },
    }))
    const sharedLayerWidth = preliminaryLayouts.reduce((widest, childLayout) => {
      if (!childLayout.isSharedLayerCandidate) {
        return widest
      }

      return Math.max(widest, childLayout.width)
    }, 0)

    for (const [index, child] of children.entries()) {
      const childLayout = layoutChildSubtree({
        child,
        dependenciesBySource,
        forcedWidth: preliminaryLayouts[index].isSharedLayerCandidate ? sharedLayerWidth : undefined,
        parentId,
        parentLabel,
        relativePosition: { x: relativeStartX, y: cursorY },
      })

      nodes.push(...childLayout.nodes)
      maxRight = Math.max(maxRight, relativeStartX + childLayout.width)
      maxBottom = Math.max(maxBottom, cursorY + childLayout.height)
      cursorY += childLayout.height + CHILD_VERTICAL_GAP
    }

    const nextY = children.length === 0 ? relativeStartY : maxBottom

    return {
      maxRight,
      nextY,
      nodes,
      rowLayout,
    }
  }

  for (const child of children) {
    const childLayout = layoutChildSubtree({
      child,
      dependenciesBySource,
      parentId,
      parentLabel,
      relativePosition: rowLayout
        ? { x: cursorX, y: relativeStartY }
        : { x: relativeStartX, y: cursorY },
    })

    nodes.push(...childLayout.nodes)

    if (rowLayout) {
      maxRight = Math.max(maxRight, cursorX + childLayout.width)
      maxBottom = Math.max(maxBottom, relativeStartY + childLayout.height)
      cursorX += childLayout.width + CHILD_HORIZONTAL_GAP
      continue
    }

    maxRight = Math.max(maxRight, relativeStartX + childLayout.width)
    maxBottom = Math.max(maxBottom, cursorY + childLayout.height)
    cursorY += childLayout.height + CHILD_VERTICAL_GAP
  }

  const nextY = children.length === 0 ? relativeStartY : maxBottom

  return {
    maxRight,
    nextY,
    nodes,
    rowLayout,
  }
}

type BuiltGraph = {
  edges: Edge[]
  nodeIds: Set<string>
  nodes: DiagramNode[]
}

function buildGeneratedGraph(promptOutput: PromptOutput): BuiltGraph {
  if (promptOutput.diagram.parents.length === 0) {
    throw new Error('Generated diagram is missing parent groups.')
  }

  const labelById = collectNodeLabels(promptOutput)
  const dependenciesBySource = collectDependenciesBySource(promptOutput, labelById)

  const generatedNodes: DiagramNode[] = []
  let rightColumnY = COLUMN_TOP_Y
  let rightColumnX = RIGHT_COLUMN_X

  for (const [index, parent] of promptOutput.diagram.parents.entries()) {
    const isPrimary = index === 0
    const parentX = isPrimary ? LEFT_COLUMN_X : rightColumnX
    const parentY = isPrimary ? COLUMN_TOP_Y : rightColumnY

    const childLayout = layoutChildren({
      children: parent.children,
      containerLabel: parent.label,
      dependenciesBySource,
      parentId: parent.id,
      parentLabel: parent.label,
      relativeStartX: PARENT_PADDING_X,
      relativeStartY: PARENT_HEADER_OFFSET_Y,
    })

    const contentWidth = childLayout.maxRight + PARENT_PADDING_X
    const parentWidth = Math.max(
      isPrimary ? PRIMARY_PARENT_MIN_WIDTH : SECONDARY_PARENT_MIN_WIDTH,
      contentWidth,
    )
    const minHeight = isPrimary ? PRIMARY_PARENT_MIN_HEIGHT : SECONDARY_PARENT_MIN_HEIGHT
    const contentHeight = childLayout.nextY + PARENT_PADDING_BOTTOM
    const parentHeight = Math.max(minHeight, contentHeight)

    if (isPrimary) {
      const primaryRightEdge = parentX + parentWidth
      rightColumnX = Math.max(RIGHT_COLUMN_X, primaryRightEdge + COLUMN_GAP_X)
    }

    generatedNodes.push(
      createNode(
        parent.id,
        parent.label,
        { x: parentX, y: parentY },
        getParentClassName(),
        buildParentMetadata(parent.label, parent.metadata, dependenciesBySource.get(parent.id) ?? []),
        {
          style: {
            height: parentHeight,
            width: parentWidth,
          },
          type: 'group',
        },
      ),
    )

    generatedNodes.push(...childLayout.nodes)
    if (!isPrimary) {
      rightColumnY = parentY + parentHeight + COLUMN_GAP_Y
    }
  }

  const nodeIds = new Set(generatedNodes.map((node) => node.id))
  if (nodeIds.size !== generatedNodes.length) {
    throw new Error('Generated diagram has duplicate node IDs.')
  }

  const generatedEdges: Edge[] = promptOutput.diagram.edges.map((edge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new Error(
          `Generated diagram has an edge referencing an unknown node: ${edge.source} -> ${edge.target}.`,
        )
      }

      const edgeStyle = EDGE_STYLES[edge.relationshipType]
      if (!edgeStyle) {
        throw new Error(`Generated diagram has unsupported edge type: ${edge.relationshipType}.`)
      }

      return {
        type: 'smoothstep',
        pathOptions: { borderRadius: 0, offset: 18 },
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: edgeStyle.animated,
        markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
        style: { stroke: edgeStyle.stroke },
        labelStyle: { fill: '#334155', fontWeight: 600, fontSize: 11 },
      }
    })

  return {
    nodes: generatedNodes,
    edges: generatedEdges,
    nodeIds,
  }
}

// export function buildInitialNodes(promptOutput: PromptOutput): DiagramNode[] {
//   return buildInitialGraph(promptOutput).nodes
// }

// export function buildInitialEdges(promptOutput: PromptOutput): Edge[] {
//   return buildInitialGraph(promptOutput).edges
// }

export function buildInitialGraph(promptOutput: PromptOutput): Pick<BuiltGraph, 'edges' | 'nodes'> {
  if (!promptOutput) {
    throw new Error('Generated diagram data is missing.')
  }

  const generatedGraph = buildGeneratedGraph(promptOutput)
  return {
    nodes: generatedGraph.nodes,
    edges: generatedGraph.edges,
  }
}
