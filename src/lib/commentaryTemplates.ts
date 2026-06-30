import archSsaImage from '../commentary-picker/arch-ssa.png'
import sdlcSsaImage from '../commentary-picker/sdlc-ssa.png'
import securitySsaImage from '../commentary-picker/security-ssa.png'
import archSsaSpec from './export/json-commentary-templates/slide-01-phase-1.compact copy.json'
import securitySsaSpec from './export/json-commentary-templates/slide-02-phase-1.compact copy.json'
import sdlcSsaSpec from './export/json-commentary-templates/slide-03-phase-1.compact copy.json'
import { ensureCommentaryBulletOrdering } from './commentaryBulletOrdering'
import type { DiagramTemplate } from './diagramTemplates'
import { normalizeBrandedSlideFrameImageIds } from './export/PowerpointBranding'

export type CommentaryTemplate = DiagramTemplate

export function normalizeCommentaryTemplateSpec(input: unknown) {
  return ensureCommentaryBulletOrdering(normalizeBrandedSlideFrameImageIds(input))
}

export const COMMENTARY_TEMPLATES: CommentaryTemplate[] = [
  {
    id: 'architecture-ssa',
    name: 'Architecture SSA',
    description:
      'A commentary slide for summarizing architecture findings, impact, remediation themes, and recommended project work.',
    image: archSsaImage,
    jsonSpec: normalizeCommentaryTemplateSpec(archSsaSpec),
    relatedAlt: 'Architecture SSA commentary slide preview',
  },
  {
    id: 'security-ssa',
    name: 'Security SSA',
    description:
      'A commentary slide for secure development findings, remediation priorities, and phase-one project recommendations.',
    image: securitySsaImage,
    jsonSpec: normalizeCommentaryTemplateSpec(securitySsaSpec),
    relatedAlt: 'Security SSA commentary slide preview',
  },
  {
    id: 'sdlc-ssa',
    name: 'SDLC SSA',
    description:
      'A commentary slide for SDLC and QA findings, operational execution gaps, and delivery improvement recommendations.',
    image: sdlcSsaImage,
    jsonSpec: normalizeCommentaryTemplateSpec(sdlcSsaSpec),
    relatedAlt: 'SDLC SSA commentary slide preview',
  },
]

export const DEFAULT_COMMENTARY_TEMPLATE_ID = 'security-ssa'

export function getCommentaryTemplateById(templateId: string | null | undefined) {
  if (!templateId) {
    return undefined
  }

  return COMMENTARY_TEMPLATES.find((template) => template.id === templateId)
}

export function getDefaultCommentaryTemplate() {
  return getCommentaryTemplateById(DEFAULT_COMMENTARY_TEMPLATE_ID) ?? COMMENTARY_TEMPLATES[0]
}
