export type ModelSelectorConfidence = 'high' | 'medium' | 'low'

export type ModelSelectorCandidateFit = {
  architecturePattern: string
  diligenceNarrative: string
  evidenceCoverage: string
  riskAndValueSignal: string
  slideReadability: string
}

export type ModelSelectorRejectedCandidate = {
  diagramId: string
  diagramName: string
  reason: string
}

export type ModelSelectorDiagramPopulationGuidance = {
  contextToEmphasize: string[]
  detailsToAvoid: string[]
  keyFlowsToShow: string[]
  primaryEntitiesToShow: string[]
}

export type ModelSelectorOutput = {
  assumptions: string[]
  candidateFit: ModelSelectorCandidateFit
  confidence: ModelSelectorConfidence
  diagramPopulationGuidance: ModelSelectorDiagramPopulationGuidance
  evidenceSummary: string[]
  missingInformation: string[]
  recommendedSlideMessage: string
  recommendedSlideTitle: string
  rejectedCandidates: ModelSelectorRejectedCandidate[]
  selectedDiagramId: string
  selectedDiagramName: string
  selectionRationale: string
}

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
} as const

export const MODEL_SELECTOR_OUTPUT_FORMAT = {
  name: 'model_selector_output',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      selectedDiagramId: { type: 'string' },
      selectedDiagramName: { type: 'string' },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      recommendedSlideTitle: { type: 'string' },
      recommendedSlideMessage: { type: 'string' },
      selectionRationale: { type: 'string' },
      evidenceSummary: stringArraySchema,
      candidateFit: {
        type: 'object',
        additionalProperties: false,
        properties: {
          architecturePattern: { type: 'string' },
          diligenceNarrative: { type: 'string' },
          evidenceCoverage: { type: 'string' },
          slideReadability: { type: 'string' },
          riskAndValueSignal: { type: 'string' },
        },
        required: [
          'architecturePattern',
          'diligenceNarrative',
          'evidenceCoverage',
          'slideReadability',
          'riskAndValueSignal',
        ],
      },
      rejectedCandidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            diagramId: { type: 'string' },
            diagramName: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['diagramId', 'diagramName', 'reason'],
        },
      },
      diagramPopulationGuidance: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primaryEntitiesToShow: stringArraySchema,
          keyFlowsToShow: stringArraySchema,
          contextToEmphasize: stringArraySchema,
          detailsToAvoid: stringArraySchema,
        },
        required: [
          'primaryEntitiesToShow',
          'keyFlowsToShow',
          'contextToEmphasize',
          'detailsToAvoid',
        ],
      },
      assumptions: stringArraySchema,
      missingInformation: stringArraySchema,
    },
    required: [
      'selectedDiagramId',
      'selectedDiagramName',
      'confidence',
      'recommendedSlideTitle',
      'recommendedSlideMessage',
      'selectionRationale',
      'evidenceSummary',
      'candidateFit',
      'rejectedCandidates',
      'diagramPopulationGuidance',
      'assumptions',
      'missingInformation',
    ],
  },
} as const
