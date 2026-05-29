export type SlideTextRun = {
  bold?: boolean
  breakLine?: boolean
  color: string
  fontFace: string
  fontSize: number
  text: string
}

export type SlideShapeElement = {
  align: 'center' | 'left' | 'right'
  bold: boolean
  fill: string
  fontFace: string
  fontSize: number
  h: number
  id: string
  padding?: number
  runs: SlideTextRun[]
  shape: 'rect' | 'flowChartMagneticDisk'
  stroke: string
  strokeWidth: number
  text: string
  textColor: string
  type: 'shape'
  valign: 'top' | 'middle' | 'bottom'
  w: number
  x: number
  y: number
}

export type SlideTextElement = {
  align: 'center' | 'left' | 'right'
  fill: string
  fontFace: string
  fontSize: number
  h: number
  id: string
  runs: SlideTextRun[]
  stroke: string
  strokeWidth: number
  text: string
  textColor: string
  type: 'text'
  valign: 'top' | 'middle' | 'bottom'
  w: number
  x: number
  y: number
}

export type SlideLineElement = {
  id: string
  stroke: string
  strokeWidth: number
  type: 'line'
  x1: number
  x2: number
  y1: number
  y2: number
}

export type SlideElement = SlideShapeElement | SlideTextElement | SlideLineElement

export type SlidePromptOutput = {
  presentation: {
    slides: Array<{
      backgroundColor: string
      elements: SlideElement[]
      height: number
      id: string
      name: string
      width: number
    }>
    title: string
  }
}

const textRunWithBoldSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    bold: { type: 'boolean' },
    color: { type: 'string' },
    fontFace: { type: 'string' },
    fontSize: { type: 'number' },
  },
  required: ['text', 'bold', 'color', 'fontFace', 'fontSize'],
} as const

const textRunWithBoldBreakLineSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    bold: { type: 'boolean' },
    color: { type: 'string' },
    fontFace: { type: 'string' },
    fontSize: { type: 'number' },
    breakLine: { type: 'boolean' },
  },
  required: ['text', 'bold', 'color', 'fontFace', 'fontSize', 'breakLine'],
} as const

const textRunWithBreakLineSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    color: { type: 'string' },
    fontFace: { type: 'string' },
    fontSize: { type: 'number' },
    breakLine: { type: 'boolean' },
  },
  required: ['text', 'color', 'fontFace', 'fontSize', 'breakLine'],
} as const

const textRunSchema = {
  anyOf: [textRunWithBoldSchema, textRunWithBoldBreakLineSchema, textRunWithBreakLineSchema],
} as const

const textRunsSchema = {
  type: 'array',
  items: textRunSchema,
} as const

const shapeElementPropertiesSchema = {
  id: { type: 'string' },
  type: {
    type: 'string',
    enum: ['shape'],
  },
  shape: {
    type: 'string',
    enum: ['rect', 'flowChartMagneticDisk'],
  },
  x: { type: 'number' },
  y: { type: 'number' },
  w: { type: 'number' },
  h: { type: 'number' },
  fill: { type: 'string' },
  stroke: { type: 'string' },
  strokeWidth: { type: 'number' },
  text: { type: 'string' },
  align: {
    type: 'string',
    enum: ['center', 'left', 'right'],
  },
  valign: {
    type: 'string',
    enum: ['top', 'middle', 'bottom'],
  },
  fontSize: { type: 'number' },
  fontFace: { type: 'string' },
  bold: { type: 'boolean' },
  textColor: { type: 'string' },
  runs: textRunsSchema,
} as const

const shapeElementRequiredKeys = [
  'id',
  'type',
  'shape',
  'x',
  'y',
  'w',
  'h',
  'fill',
  'stroke',
  'strokeWidth',
  'text',
  'align',
  'valign',
  'fontSize',
  'fontFace',
  'bold',
  'textColor',
  'runs',
] as const

const shapeElementSchema = {
  anyOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: shapeElementPropertiesSchema,
      required: shapeElementRequiredKeys,
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...shapeElementPropertiesSchema,
        padding: { type: 'number' },
      },
      required: [...shapeElementRequiredKeys, 'padding'],
    },
  ],
} as const

const textElementSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    type: {
      type: 'string',
      enum: ['text'],
    },
    x: { type: 'number' },
    y: { type: 'number' },
    w: { type: 'number' },
    h: { type: 'number' },
    fill: { type: 'string' },
    stroke: { type: 'string' },
    strokeWidth: { type: 'number' },
    text: { type: 'string' },
    align: {
      type: 'string',
      enum: ['center', 'left', 'right'],
    },
    valign: {
      type: 'string',
      enum: ['top', 'middle', 'bottom'],
    },
    fontSize: { type: 'number' },
    fontFace: { type: 'string' },
    textColor: { type: 'string' },
    runs: textRunsSchema,
  },
  required: [
    'id',
    'type',
    'x',
    'y',
    'w',
    'h',
    'fill',
    'stroke',
    'strokeWidth',
    'text',
    'align',
    'valign',
    'fontSize',
    'fontFace',
    'textColor',
    'runs',
  ],
} as const

const lineElementSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    type: {
      type: 'string',
      enum: ['line'],
    },
    x1: { type: 'number' },
    y1: { type: 'number' },
    x2: { type: 'number' },
    y2: { type: 'number' },
    stroke: { type: 'string' },
    strokeWidth: { type: 'number' },
  },
  required: ['id', 'type', 'x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth'],
} as const

export const powerpointArchitectureSlideSchema = {
  name: 'powerpoint_architecture_slide',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      presentation: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          slides: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
                backgroundColor: { type: 'string' },
                elements: {
                  type: 'array',
                  items: {
                    anyOf: [shapeElementSchema, lineElementSchema, textElementSchema],
                  },
                },
              },
              required: ['id', 'name', 'width', 'height', 'backgroundColor', 'elements'],
            },
          },
        },
        required: ['title', 'slides'],
      },
    },
    required: ['presentation'],
  },
} as const

export const SLIDE_PROMPT_OUTPUT_FORMAT = powerpointArchitectureSlideSchema
