import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'

import { buildPptxPresentation } from '../src/lib/export/PowerpointRenderer.ts'
import { normalizePresentationSpec } from '../src/lib/export/PowerpointNormalizer.ts'
import type { ValidationIssue } from '../src/lib/export/PowerpointTypes.ts'
import {
  SLIDE_PROMPT_OUTPUT_FORMAT,
  type SlidePromptOutput,
} from '../src/types/SlidePromptOutput.ts'

const PORT = Number.parseInt(process.env.PPTXGENJS_PORT ?? '8787', 10)
const MAX_BODY_BYTES = 50 * 1024 * 1024
const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.2'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const ALLOWED_EXTENSIONS = new Set([
  'docx',
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
const MIME_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  markdown: 'text/plain',
  md: 'text/plain',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
}
const TEMPLATE_FILES: Record<string, string> = {
  'layered-architecture': 'layered-arch.json',
  'layered-platform': 'layered-arch-2.json',
  'microservice-architecture': 'microservice-arch.json',
  'multi-tenant-system': 'two-system-arch.json',
  'multi-application-ecosystem': 'multi-app-arch.json',
  'product-architecture': 'multi-product-arch.json',
}
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  'layered-architecture': 'A clean layered view for presentation, service, integration, and data responsibilities.',
  'layered-platform': 'A denser platform-oriented view for shared services and cross-cutting concerns.',
  'microservice-architecture': 'A distributed view for service boundaries, API interactions, data ownership, and infrastructure.',
  'multi-tenant-system': 'A view for tenant isolation, shared infrastructure, and service boundaries.',
  'multi-application-ecosystem': 'A view for several products or applications connected through services, integrations, and data.',
  'product-architecture': 'A product-centric view emphasizing modules, integrations, and end-to-end capabilities.',
}

type MaterialInput = {
  name: string
  type?: string
  content?: string
  base64?: string
  data?: string
}

type GenerateRequest = {
  mode?: 'create' | 'update'
  prompt?: string
  templateId?: string
  templateJson?: unknown
  materials?: MaterialInput[]
}

type Material = {
  name: string
  mimeType: string
  bytes: Buffer
}

export type PptxGenJsResponse = {
  fileName: string
  issues: ValidationIssue[]
  presentation: unknown
  pptxJson: string
}

export async function createPptxGenJsResponse(
  request: GenerateRequest,
): Promise<PptxGenJsResponse> {
  if (!request || typeof request !== 'object') {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }

  if (request.mode !== undefined && request.mode !== 'create' && request.mode !== 'update') {
    throw new HttpError(400, 'mode must be create or update.')
  }

  if (request.materials !== undefined && !Array.isArray(request.materials)) {
    throw new HttpError(400, 'materials must be an array.')
  }

  const materials = normalizeMaterials(request.materials ?? [])

  if (materials.length === 0) {
    throw new HttpError(400, 'Add at least one material file or material object.')
  }

  const mode = request.mode ?? (request.templateJson ? 'update' : 'create')
  const template = await resolveTemplate(request.templateId, request.templateJson)
  const generatedJson = await generateSlideJson({
    materials,
    mode,
    prompt: request.prompt,
    template,
  })
  const normalized = normalizePresentationSpec(generatedJson)
  const errors = normalized.issues.filter((issue) => issue.level === 'error')

  if (!normalized.presentation || errors.length > 0) {
    throw new HttpError(422, formatIssues('Generated slide JSON could not be rendered.', normalized.issues))
  }

  const pptx = buildPptxPresentation(normalized.presentation, {
    brandingImageSource: await getLogoDataUrl(),
  })

  return {
    fileName: buildSuggestedFileName(normalized.presentation.meta.title),
    issues: normalized.issues,
    presentation: normalized.presentation,
    pptxJson: JSON.stringify(pptx),
  }
}

async function generateSlideJson({
  materials,
  mode,
  prompt,
  template,
}: {
  materials: Material[]
  mode: 'create' | 'update'
  prompt?: string
  template?: { id: string; name: string; description: string; jsonSpec: unknown }
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    throw new HttpError(500, 'The service is missing OPENAI_API_KEY.')
  }

  if (mode === 'update' && !template) {
    throw new HttpError(400, 'Update mode requires templateId or templateJson.')
  }

  const openai = new OpenAI({ apiKey })
  const response = await openai.responses.create({
    model: DEFAULT_MODEL,
    instructions: await readPrompt(mode === 'create' ? 'SlideDiagramGenerationPrompt.md' : 'SlideTextOnlyPrompt.md'),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: await buildGenerationPrompt({ materials, mode, prompt, template }),
          },
          ...(await buildOpenAIFileInputs(materials)),
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        ...SLIDE_PROMPT_OUTPUT_FORMAT,
      },
    },
  })

  if (!response.output_text) {
    throw new HttpError(502, 'OpenAI did not return structured slide JSON.')
  }

  return constrainSlideBounds(removeGeneratedLineElements(JSON.parse(response.output_text) as SlidePromptOutput))
}

async function buildGenerationPrompt({
  materials,
  mode,
  prompt,
  template,
}: {
  materials: Material[]
  mode: 'create' | 'update'
  prompt?: string
  template?: { id: string; name: string; description: string; jsonSpec: unknown }
}) {
  const materialManifest = JSON.stringify(
    materials.map((material) => ({
      name: material.name,
      type: material.mimeType,
      sizeBytes: material.bytes.byteLength,
    })),
    null,
    2,
  )

  if (mode === 'update' && template) {
    return [
      prompt?.trim() || 'Use the attached technical information to update the slide text values.',
      'Return the full resulting JSON object after editing only allowed text values.',
      'Selected architecture template:',
      JSON.stringify({ id: template.id, name: template.name, description: template.description }, null, 2),
      'Base PowerPoint architecture diagram JSON:',
      JSON.stringify(template.jsonSpec, null, 2),
      'The uploaded diligence source files are:',
      materialManifest,
    ].join('\n\n')
  }

  const examples = await Promise.all(Object.entries(TEMPLATE_FILES).map(async ([id, fileName]) => ({
    id,
    name: idToName(id),
    description: TEMPLATE_DESCRIPTIONS[id],
    jsonSpec: await readJsonTemplate(fileName),
  })))

  return [
    'Create a new architecture diagram JSON object from the uploaded source material.',
    'This should be a platform-level M&A due diligence architecture and data-flow view.',
    'Prioritize applications and modules that directly develop, deliver, or support the product platform. Deprioritize back-office applications unless they are critical integrations or materially affect platform operations.',
    prompt?.trim() ? `Use this additional user guidance:\n${prompt.trim()}` : '',
    template
      ? `Use the ${template.name} style and layout as the primary starting point.`
      : 'Choose the example style and layout that best fits the source material.',
    'Do not redesign typography, colors, theme values, or styling. Preserve those values from the examples and only choose which existing example style pattern to reuse for each element.',
    'The uploaded diligence source files are:',
    materialManifest,
    'Architecture diagram JSON examples:',
    JSON.stringify(examples, null, 2),
    'Generate one complete new architecture diagram JSON for the uploaded source material. Return the JSON object directly.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function buildOpenAIFileInputs(materials: Material[]) {
  return materials.map((material) => {
    const dataUrl = `data:${material.mimeType};base64,${material.bytes.toString('base64')}`

    if (material.mimeType.startsWith('image/')) {
      return {
        type: 'input_image' as const,
        image_url: dataUrl,
        detail: 'auto' as const,
      }
    }

    return {
      type: 'input_file' as const,
      filename: material.name,
      file_data: dataUrl,
    }
  })
}

function normalizeMaterials(materialInputs: MaterialInput[]) {
  return materialInputs.map((input, index) => {
    if (!input || typeof input !== 'object') {
      throw new HttpError(400, `Material ${index + 1} must be an object.`)
    }

    const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : `material-${index + 1}.txt`
    const extension = getExtension(name)
    const mimeType = resolveMimeType(input.type, extension)
    const encoded = input.base64 ?? input.data
    const bytes = encoded
      ? decodeBase64(encoded)
      : typeof input.content === 'string'
        ? Buffer.from(input.content, 'utf8')
        : undefined

    if (!bytes) {
      throw new HttpError(400, `Material ${name} must include content, base64, or data.`)
    }

    assertAllowedMaterial(name, mimeType)
    return { name, mimeType, bytes }
  })
}

async function parseRequest(req: IncomingMessage) {
  const body = await readRequestBody(req)
  const rawContentType = req.headers['content-type'] ?? ''
  const contentType = Array.isArray(rawContentType) ? rawContentType[0] ?? '' : rawContentType

  if (contentType.toLowerCase().startsWith('multipart/form-data')) {
    return parseMultipartBody(body, contentType)
  }

  throw new HttpError(415, 'Upload materials as multipart/form-data files.')
}

async function parseMultipartBody(body: Buffer, contentType: string): Promise<GenerateRequest> {
  const request = new globalThis.Request('http://localhost/api/pptxgenjs', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: body as unknown as BodyInit,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
  const formData = await request.formData()
  const materials: MaterialInput[] = []
  let mode: GenerateRequest['mode']
  let prompt: string | undefined
  let templateId: string | undefined
  let templateJson: unknown

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') {
      materials.push({ name: value.name, type: value.type, base64: Buffer.from(await value.arrayBuffer()).toString('base64') })
      continue
    }

    if (key === 'materials') {
      throw new HttpError(400, 'Send materials as multipart file fields, not base64 JSON.')
    } else if (key === 'mode') {
      if (value !== 'create' && value !== 'update') {
        throw new HttpError(400, 'mode must be create or update.')
      }
      mode = value
    } else if (key === 'prompt') {
      prompt = value
    } else if (key === 'templateId') {
      templateId = value
    } else if (key === 'templateJson') {
      templateJson = parseJsonField(value, 'templateJson')
    }
  }

  return { materials, mode, prompt, templateId, templateJson }
}

async function resolveTemplate(templateId?: string, templateJson?: unknown) {
  if (templateJson !== undefined) {
    return {
      id: templateId ?? 'custom-template',
      name: templateId ? idToName(templateId) : 'Custom template',
      description: 'A caller-supplied architecture template.',
      jsonSpec: templateJson,
    }
  }

  if (!templateId) {
    return undefined
  }

  const fileName = TEMPLATE_FILES[templateId]
  if (!fileName) {
    throw new HttpError(400, `Unknown templateId: ${templateId}.`)
  }

  return {
    id: templateId,
    name: idToName(templateId),
    description: TEMPLATE_DESCRIPTIONS[templateId] ?? 'Architecture diagram template.',
    jsonSpec: await readJsonTemplate(fileName),
  }
}

async function readJsonTemplate(fileName: string) {
  const filePath = new URL(`../src/lib/export/json-slide-templates/${fileName}`, import.meta.url)
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function parseJsonField(value: string, fieldName: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new HttpError(400, `${fieldName} must contain valid JSON.`)
  }
}

async function readPrompt(fileName: string) {
  return readFile(new URL(`../src/prompts/${fileName}`, import.meta.url), 'utf8')
}

let logoDataUrlPromise: Promise<string> | undefined
function getLogoDataUrl() {
  logoDataUrlPromise ??= readFile(new URL('../src/slide-assets/element-5.png', import.meta.url)).then(
    (bytes) => `data:image/png;base64,${bytes.toString('base64')}`,
  )
  return logoDataUrlPromise
}

function removeGeneratedLineElements(output: SlidePromptOutput): SlidePromptOutput {
  return {
    ...output,
    presentation: {
      ...output.presentation,
      slides: output.presentation.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.filter((element) => element.type !== 'line'),
      })),
    },
  }
}

function constrainSlideBounds(output: SlidePromptOutput): SlidePromptOutput {
  return {
    ...output,
    presentation: {
      ...output.presentation,
      slides: output.presentation.slides.map((slide) => {
        const width = Math.max(slide.width, 1)
        const height = Math.max(slide.height, 1)
        return {
          ...slide,
          elements: slide.elements
            .filter((element) => element.type !== 'line')
            .map((element) => {
              const x = clamp(element.x, 0, width)
              const y = clamp(element.y, 0, height)
              return {
                ...element,
                x,
                y,
                w: clamp(element.w, 1, Math.max(width - x, 1)),
                h: clamp(element.h, 1, Math.max(height - y, 1)),
              }
            }),
        }
      }),
    },
  }
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min
}

function decodeBase64(value: string) {
  const base64 = (value.includes(',') ? value.slice(value.indexOf(',') + 1) : value).replace(/\s+/g, '')
  try {
    if (!base64 || base64.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(base64)) {
      throw new Error('Invalid base64.')
    }
    return Buffer.from(base64, 'base64')
  } catch {
    throw new HttpError(400, 'Material base64 data is invalid.')
  }
}

function assertAllowedMaterial(name: string, mimeType: string) {
  const extension = getExtension(name)
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new HttpError(415, `Unsupported material type: ${name}. Allowed: DOCX, PDF, PPT/PPTX, PNG/JPG, Markdown, TXT, RTF.`)
  }
}

function resolveMimeType(reportedMimeType: string | undefined, extension: string) {
  const extensionMimeType = MIME_BY_EXTENSION[extension]
  if (extensionMimeType) {
    return extensionMimeType
  }

  const mimeType = reportedMimeType?.split(';', 1)[0]?.trim().toLowerCase()
  return mimeType || 'application/octet-stream'
}

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function idToName(id: string) {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildSuggestedFileName(title: string) {
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${stem || 'generated-presentation'}.pptx`
}

function formatIssues(header: string, issues: ValidationIssue[]) {
  const details = issues.map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`).join('\n')
  return details ? `${header}\n${details}` : header
}

function readRequestBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0

    req.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buffer.byteLength
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body is too large. Maximum size is 50 MB.'))
        req.destroy()
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

class HttpError extends Error {
  readonly statusCode: number

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message)
    this.statusCode = statusCode
  }
}

const CORS_ORIGIN = process.env.PPTXGENJS_CORS_ORIGIN?.trim() || 'http://localhost:5173'

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'access-control-allow-origin': CORS_ORIGIN,
    'content-type': JSON_CONTENT_TYPE,
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-origin': CORS_ORIGIN,
    res.end()
    return
  }

  if (req.method !== 'POST' || req.url !== '/api/pptxgenjs') {
    writeJson(res, 404, { error: 'Not found.' })
    return
  }

  try {
    const request = await parseRequest(req)
    writeJson(res, 200, await createPptxGenJsResponse(request))
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected service error.'
    writeJson(res, statusCode, { error: message })
  }
}

export function startPptxGenJsService(port = PORT) {
  const server = createServer(handleRequest)
  server.listen(port, () => {
    console.log(`PPTXGenJS service listening on http://localhost:${port}/api/pptxgenjs`)
  })
  return server
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startPptxGenJsService()
}
