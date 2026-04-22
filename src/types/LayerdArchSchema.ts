const metadataSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    owner: { type: 'string' },
    system: { type: 'string' },
    runtime: { type: 'string' },
    environment: { type: 'string' },
    region: { type: 'string' },
    sla: { type: 'string' },
    last_deployed: { type: 'string' },
    dependencies: {
      type: 'array',
      items: { type: 'string' },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'summary',
    'owner',
    'system',
    'runtime',
    'environment',
    'region',
    'sla',
    'last_deployed',
    'dependencies',
    'tags',
  ],
}

export const reactFlowArchitectureDiagramSchema = {
  name: 'react_flow_architecture_diagram',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      diagram: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: {
            type: 'string',
          },
          parents: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: {
                  type: 'string',
                },
                label: {
                  type: 'string',
                },
                nodeType: {
                  type: 'string',
                  enum: ['group'],
                },
                shape: {
                  type: 'string',
                  enum: ['rectangle'],
                },
                metadata: metadataSchema,
                children: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: {
                        type: 'string',
                      },
                      label: {
                        type: 'string',
                      },
                      nodeType: {
                        type: 'string',
                        enum: ['node'],
                      },
                      subtitle: {
                        type: 'string',
                      },
                      technology: {
                        type: 'string',
                      },
                      deployment: {
                        type: 'string',
                      },
                      shape: {
                        type: 'string',
                        enum: ['rectangle', 'cylinder', 'label'],
                      },
                      metadata: metadataSchema,
                      children: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            id: { type: 'string' },
                            label: { type: 'string' },
                            nodeType: {
                              type: 'string',
                              enum: ['node'],
                            },
                            subtitle: { type: 'string' },
                            technology: { type: 'string' },
                            deployment: { type: 'string' },
                            shape: {
                              type: 'string',
                              enum: ['rectangle', 'cylinder', 'label'],
                            },
                            metadata: metadataSchema,
                          },
                          required: [
                            'id',
                            'label',
                            'nodeType',
                            'subtitle',
                            'technology',
                            'deployment',
                            'shape',
                            'metadata',
                          ],
                        },
                      },
                    },
                    required: [
                      'id',
                      'label',
                      'nodeType',
                      'subtitle',
                      'technology',
                      'deployment',
                      'shape',
                      'metadata',
                      'children',
                    ],
                  },
                },
              },
              required: ['id', 'label', 'nodeType', 'shape', 'metadata', 'children'],
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
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
                relationshipType: {
                  type: 'string',
                  enum: ['flow', 'api', 'data', 'queue', 'analytics'],
                },
              },
              required: ['id', 'source', 'target', 'label', 'relationshipType'],
            },
          },
        },
        required: ['title', 'parents', 'edges'],
      },
    },
    required: ['diagram'],
  },
} as const
