import layeredArchImage from '../arch-picker/layered-arch.png'
import layeredArchVariantImage from '../arch-picker/layered-arch-2.png'
import microserviceArchImage from '../arch-picker/microservice-arch.png'
import multiAppArchImage from '../arch-picker/multi-app-arch.png'
import multiTenantArchImage from '../arch-picker/multi-tenant-arch.png'
import productArchImage from '../arch-picker/product-arch-2.png'
import layeredArchSpec from './export/json-slide-templates/layered-arch.json'
import layeredArchVariantSpec from './export/json-slide-templates/layered-arch-2.json'
import microserviceArchSpec from './export/json-slide-templates/microservice-arch.json'
import multiAppArchSpec from './export/json-slide-templates/multi-app-arch.json'
import multiTenantArchSpec from './export/json-slide-templates/two-system-arch.json'
import productArchSpec from './export/json-slide-templates/multi-product-arch.json'

export type DiagramTemplate = {
  description: string
  id: string
  image: string
  jsonSpec: unknown
  name: string
  relatedAlt: string
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: 'layered-architecture',
    name: 'Layered Architecture',
    description:
      'A clean layered view for showing presentation, service, integration, and data responsibilities across one application stack.',
    image: layeredArchImage,
    jsonSpec: layeredArchSpec,
    relatedAlt: 'Layered architecture diagram preview',
  },
  {
    id: 'layered-platform',
    name: 'Layered Platform',
    description:
      'A denser platform-oriented variant that helps explain shared services, internal enablement layers, and cross-cutting concerns.',
    image: layeredArchVariantImage,
    jsonSpec: layeredArchVariantSpec,
    relatedAlt: 'Layered platform architecture preview',
  },
  {
    id: 'microservice-architecture',
    name: 'Microservice Architecture',
    description:
      'A microservice architecture template for showing service boundaries, API interaction points, data ownership, and supporting infrastructure across distributed capabilities.',
    image: microserviceArchImage,
    jsonSpec: microserviceArchSpec,
    relatedAlt: 'Microservice architecture diagram preview',
  },
  {
    id: 'multi-tenant-system',
    name: 'Multi-Tenant System',
    description:
      'A multi-tenant diagram template for illustrating tenant isolation, shared infrastructure, and service boundaries in one product ecosystem.',
    image: multiTenantArchImage,
    jsonSpec: multiTenantArchSpec,
    relatedAlt: 'Multi-tenant system diagram preview',
  },
  {
    id: 'multi-application-ecosystem',
    name: 'Multi-Application Ecosystem',
    description:
      'A multi-application architecture template for showing how several products or business applications interact through shared services, integrations, and data flows.',
    image: multiAppArchImage,
    jsonSpec: multiAppArchSpec,
    relatedAlt: 'Multi-application ecosystem diagram preview',
  },
  {
    id: 'product-architecture',
    name: 'Product Architecture',
    description:
      'A product-centric architecture view that emphasizes product modules, supporting integrations, and how business capabilities connect end to end.',
    image: productArchImage,
    jsonSpec: productArchSpec,
    relatedAlt: 'Product architecture diagram preview',
  },
]

export const DEFAULT_DIAGRAM_TEMPLATE_ID = 'layered-platform'

export function getDiagramTemplateById(templateId: string | null | undefined) {
  if (!templateId) {
    return undefined
  }

  return DIAGRAM_TEMPLATES.find((template) => template.id === templateId)
}

export function getDefaultDiagramTemplate() {
  return getDiagramTemplateById(DEFAULT_DIAGRAM_TEMPLATE_ID) ?? DIAGRAM_TEMPLATES[0]
}
