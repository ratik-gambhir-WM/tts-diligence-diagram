import { MarkerType } from '@xyflow/react'
import type { DefaultEdgeOptions, Edge, Node } from '@xyflow/react'
import type { PromptOutput, PromptOutputNode, PromptOutputNodeKind, PromptOutputNodeTone } from '../types/PromptOutput'

export const ALLOWED_EXTENSIONS = new Set(['pdf', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'md', 'markdown', 'txt', 'rtf'])

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
  markerEnd: { type: MarkerType.ArrowClosed },
}

function createNode(
  id: string,
  label: string,
  position: { x: number; y: number },
  className: string,
  metadata: NodeMetadata,
  type?: DiagramNode['type'],
): DiagramNode {
  return {
    id,
    position,
    data: { label, metadata },
    className,
    type,
  }
}

function buildPromptInputNode(message: string): DiagramNode {
  return createNode(
    'input',
    `Prompt\n${message || 'Architecture idea'}`,
    { x: 20, y: 120 },
    '!w-[220px] !rounded-[18px] !border !border-amber-500 !bg-amber-50 !p-3 !text-left !shadow-none !whitespace-pre-line',
    {
      dependencies: ['Generated architecture graph'],
      environment: 'Prompt Intake',
      lastDeployed: 'N/A',
      owner: 'Design Studio',
      region: 'local',
      runtime: 'Prompt-to-diagram generation',
      sla: 'N/A',
      summary: 'Captures the submitted architecture prompt and anchors the generated system graph.',
      system: 'Architecture Input',
      tags: ['prompt', 'entrypoint', 'context'],
    },
    'input',
  )
}

function buildFallbackNodes(): DiagramNode[] {
  return [
    createNode(
      'gateway',
      'API Gateway',
      { x: 320, y: 120 },
      '!w-[170px] !rounded-[18px] !border !border-sky-400 !bg-blue-50 !p-3 !text-left !shadow-none',
      {
        dependencies: ['User Service', 'Payments Service'],
        environment: 'Production',
        lastDeployed: '2026-03-08 14:05 CST',
        owner: 'Edge Engineering',
        region: 'us-east-1',
        runtime: 'Node.js 22',
        sla: '99.95%',
        summary: 'Terminates client requests, applies auth policies, and fans out traffic to services.',
        system: 'Customer Edge',
        tags: ['gateway', 'auth', 'routing'],
      },
    ),
    createNode(
      'service-a',
      'User Service',
      { x: 590, y: 30 },
      '!w-[170px] !rounded-[18px] !border !border-green-500 !bg-green-50 !p-3 !text-left !shadow-none',
      {
        dependencies: ['Shared Data Store', 'Auth provider'],
        environment: 'Production',
        lastDeployed: '2026-03-09 09:42 CST',
        owner: 'Identity Team',
        region: 'us-east-1',
        runtime: 'Go 1.25',
        sla: '99.9%',
        summary: 'Owns user profile reads and writes, plus identity lifecycle events.',
        system: 'Identity Domain',
        tags: ['user', 'profile', 'crud'],
      },
    ),
    createNode(
      'service-b',
      'Payments Service',
      { x: 590, y: 210 },
      '!w-[170px] !rounded-[18px] !border !border-violet-400 !bg-violet-50 !p-3 !text-left !shadow-none',
      {
        dependencies: ['Shared Data Store', 'Fraud queue', 'Ledger API'],
        environment: 'Production',
        lastDeployed: '2026-03-07 18:11 CST',
        owner: 'Revenue Systems',
        region: 'us-west-2',
        runtime: 'Java 21',
        sla: '99.99%',
        summary: 'Processes charges, refunds, and payment reconciliation workflows.',
        system: 'Commerce Core',
        tags: ['payments', 'billing', 'critical-path'],
      },
    ),
    createNode(
      'database',
      'Shared Data Store',
      { x: 880, y: 120 },
      '!w-[190px] !rounded-[18px] !border !border-rose-400 !bg-rose-50 !p-3 !text-left !shadow-none',
      {
        dependencies: ['Encrypted backups', 'Analytics replica'],
        environment: 'Production',
        lastDeployed: '2026-03-05 23:30 CST',
        owner: 'Data Platform',
        region: 'multi-region',
        runtime: 'PostgreSQL 16',
        sla: '99.99%',
        summary: 'Stores transactional records and serves replicated reads to dependent services.',
        system: 'Operational Data',
        tags: ['database', 'stateful', 'replication'],
      },
    ),
  ]
}

function getNodeClassName(kind: PromptOutputNodeKind, tone: PromptOutputNodeTone) {
  const toneClasses: Record<PromptOutputNodeTone, { border: string; background: string }> = {
    sky: { border: '!border-sky-400', background: '!bg-blue-50' },
    emerald: { border: '!border-green-500', background: '!bg-green-50' },
    violet: { border: '!border-violet-400', background: '!bg-violet-50' },
    rose: { border: '!border-rose-400', background: '!bg-rose-50' },
    amber: { border: '!border-amber-500', background: '!bg-amber-50' },
    slate: { border: '!border-slate-400', background: '!bg-slate-100' },
  }

  const widths: Record<PromptOutputNodeKind, string> = {
    service: '!w-[180px]',
    database: '!w-[190px]',
    queue: '!w-[180px]',
    gateway: '!w-[180px]',
    worker: '!w-[180px]',
    external: '!w-[180px]',
  }

  return [
    widths[kind],
    '!rounded-[18px]',
    '!border',
    toneClasses[tone].border,
    toneClasses[tone].background,
    '!p-3',
    '!text-left',
    '!shadow-none',
  ].join(' ')
}

function mapPromptNode(node: PromptOutputNode): DiagramNode {
  return createNode(
    node.id,
    node.label,
    {
      x: node.position.x + 280,
      y: node.position.y + 40,
    },
    getNodeClassName(node.kind, node.tone),
    node.metadata,
  )
}

export function buildInitialNodes(message: string, promptOutput?: PromptOutput | null): DiagramNode[] {
  const inputNode = buildPromptInputNode(message)

  if (!promptOutput) {
    return [inputNode, ...buildFallbackNodes()]
  }

  return [inputNode, ...promptOutput.nodes.map(mapPromptNode)]
}

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'input', target: 'gateway', ...DEFAULT_EDGE_OPTIONS },
  { id: 'e2-3', source: 'gateway', target: 'service-a', ...DEFAULT_EDGE_OPTIONS },
  { id: 'e2-4', source: 'gateway', target: 'service-b', ...DEFAULT_EDGE_OPTIONS },
  { id: 'e3-5', source: 'service-a', target: 'database', ...DEFAULT_EDGE_OPTIONS },
  { id: 'e4-5', source: 'service-b', target: 'database', ...DEFAULT_EDGE_OPTIONS },
]

export function buildInitialEdges(promptOutput?: PromptOutput | null): Edge[] {
  if (!promptOutput) {
    return INITIAL_EDGES
  }

  const nodeIds = new Set(promptOutput.nodes.map((node) => node.id))
  const targetedNodeIds = new Set(promptOutput.edges.map((edge) => edge.target))
  const rootNodeIds = promptOutput.nodes
    .map((node) => node.id)
    .filter((nodeId) => !targetedNodeIds.has(nodeId))

  const promptEdges: Edge[] = rootNodeIds.map((target, index) => ({
    id: `prompt-${target}-${index}`,
    source: 'input',
    target,
    ...DEFAULT_EDGE_OPTIONS,
  }))

  const generatedEdges: Edge[] = promptOutput.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      animated: edge.animated,
      markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
    }))

  return [...promptEdges, ...generatedEdges]
}
