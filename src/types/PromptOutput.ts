import { reactFlowArchitectureDiagramSchema } from './LayerdArchSchema'

export type PromptOutputShape = 'rectangle' | 'cylinder' | 'label'

export type PromptOutputRelationshipType = 'flow' | 'api' | 'data' | 'queue' | 'analytics'

export type PromptOutputNodeMetadata = {
  dependencies: string[]
  environment: string
  last_deployed: string
  owner: string
  region: string
  runtime: string
  sla: string
  summary: string
  system: string
  tags: string[]
}

export type PromptOutputLeafNode = {
  deployment?: string
  id: string
  label: string
  metadata: PromptOutputNodeMetadata
  nodeType: 'node'
  shape: PromptOutputShape
  subtitle?: string
  technology?: string
}

export type PromptOutputChildNode = PromptOutputLeafNode & {
  children?: PromptOutputLeafNode[]
}

export type PromptOutputParentMetadataValue = string | string[]
export type PromptOutputParentMetadata = PromptOutputNodeMetadata

export type PromptOutputParentNode = {
  children: PromptOutputChildNode[]
  id: string
  label: string
  metadata: PromptOutputParentMetadata
  nodeType: 'group'
  shape: 'rectangle'
}

export type PromptOutputEdge = {
  id: string
  label: string
  relationshipType: PromptOutputRelationshipType
  source: string
  target: string
}

export type PromptOutput = {
  diagram: {
    edges: PromptOutputEdge[]
    parents: PromptOutputParentNode[]
    title: string
  }
}

export const PROMPT_OUTPUT_FORMAT = reactFlowArchitectureDiagramSchema
