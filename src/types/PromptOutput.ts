export const PROMPT_OUTPUT_NODE_KINDS = [
  'service',
  'database',
  'queue',
  'gateway',
  'worker',
  'external',
] as const

export const PROMPT_OUTPUT_NODE_TONES = ['sky', 'emerald', 'violet', 'rose', 'amber', 'slate'] as const

export type PromptOutputNodeKind = (typeof PROMPT_OUTPUT_NODE_KINDS)[number]
export type PromptOutputNodeTone = (typeof PROMPT_OUTPUT_NODE_TONES)[number]

export type PromptOutputNodeMetadata = {
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

export type PromptOutputNode = {
  id: string
  kind: PromptOutputNodeKind
  label: string
  metadata: PromptOutputNodeMetadata
  position: {
    x: number
    y: number
  }
  tone: PromptOutputNodeTone
}

export type PromptOutputEdge = {
  animated: boolean
  id: string
  label: string
  source: string
  target: string
}

export type PromptOutput = {
  assumptions: string[]
  edges: PromptOutputEdge[]
  layoutDirection: 'LR' | 'TB'
  nodes: PromptOutputNode[]
  summary: string
  title: string
}

export const PROMPT_OUTPUT_SCHEMA_NAME = 'diagram_prompt_output'

export const PROMPT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'layoutDirection', 'assumptions', 'nodes', 'edges'],
  properties: {
    title: {
      type: 'string',
      description: 'A short title for the architecture diagram.',
    },
    summary: {
      type: 'string',
      description: 'A concise summary of the architecture.',
    },
    layoutDirection: {
      type: 'string',
      enum: ['LR', 'TB'],
      description: 'Preferred high-level layout direction for the canvas.',
    },
    assumptions: {
      type: 'array',
      description: 'Important assumptions or inferred details used to build the architecture.',
      items: {
        type: 'string',
      },
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'kind', 'tone', 'position', 'metadata'],
        properties: {
          id: {
            type: 'string',
            description: 'Stable slug-like node identifier.',
          },
          label: {
            type: 'string',
            description: 'Display label for the node.',
          },
          kind: {
            type: 'string',
            enum: [...PROMPT_OUTPUT_NODE_KINDS],
          },
          tone: {
            type: 'string',
            enum: [...PROMPT_OUTPUT_NODE_TONES],
          },
          position: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y'],
            properties: {
              x: {
                type: 'number',
              },
              y: {
                type: 'number',
              },
            },
          },
          metadata: {
            type: 'object',
            additionalProperties: false,
            required: [
              'summary',
              'owner',
              'system',
              'runtime',
              'environment',
              'region',
              'sla',
              'lastDeployed',
              'dependencies',
              'tags',
            ],
            properties: {
              summary: {
                type: 'string',
              },
              owner: {
                type: 'string',
              },
              system: {
                type: 'string',
              },
              runtime: {
                type: 'string',
              },
              environment: {
                type: 'string',
              },
              region: {
                type: 'string',
              },
              sla: {
                type: 'string',
              },
              lastDeployed: {
                type: 'string',
              },
              dependencies: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'source', 'target', 'label', 'animated'],
        properties: {
          id: {
            type: 'string',
          },
          source: {
            type: 'string',
          },
          target: {
            type: 'string',
          },
          label: {
            type: 'string',
          },
          animated: {
            type: 'boolean',
          },
        },
      },
    },
  },
} as const

export const PROMPT_OUTPUT_FORMAT = {
  type: 'json_schema',
  name: PROMPT_OUTPUT_SCHEMA_NAME,
  strict: true,
  schema: PROMPT_OUTPUT_SCHEMA,
  description: 'Structured architecture diagram data for rendering a React Flow canvas.',
} as const
