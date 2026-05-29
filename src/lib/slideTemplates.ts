import type { PromptOutput } from '../types/PromptOutput'

export type SlideTemplateOption = {
  id: string
  label: string
  promptOutput: PromptOutput
}

type JsonModule = {
  default: PromptOutput
}

function toTemplateLabel(templateId: string) {
  return templateId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const templateModules = import.meta.glob('./export/json-slide-templates/*.json', {
  eager: true,
}) as Record<string, JsonModule>

export const SLIDE_TEMPLATE_OPTIONS: SlideTemplateOption[] = Object.entries(templateModules)
  .map(([path, module]) => {
    const fileName = path.split('/').pop() ?? 'template.json'
    const templateId = fileName.replace(/\.json$/i, '')

    return {
      id: templateId,
      label: toTemplateLabel(templateId),
      promptOutput: module.default,
    }
  })
  .sort((left, right) => left.label.localeCompare(right.label))

export const DEFAULT_SLIDE_TEMPLATE_ID = SLIDE_TEMPLATE_OPTIONS.find(
  (template) => template.id === 'product-architecture-reference',
)?.id ?? SLIDE_TEMPLATE_OPTIONS[0]?.id ?? 'product-architecture-reference'

export function getSlideTemplateById(templateId: string) {
  return SLIDE_TEMPLATE_OPTIONS.find((template) => template.id === templateId) ?? SLIDE_TEMPLATE_OPTIONS[0]
}
