import OpenAIClient from 'openai'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseInput,
  ResponseInputContent,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputText,
} from 'openai/resources/responses/responses'

import slideTextOnlyInstructions from '../prompts/SlideTextOnlyPrompt.md?raw'
import { SLIDE_PROMPT_OUTPUT_FORMAT } from '../types/SlidePromptOutput'
import type { SlidePromptOutput } from '../types/SlidePromptOutput'
import { getExtension } from '../utils/files'

type CreateOpenAIResponseParams = {
  attachments?: File[]
  model?: string
  prompt: string
  systemInstructions?: string
  text?: ResponseCreateParamsNonStreaming['text']
}

type GenerateSlidePromptOutputParams = {
  attachments?: File[]
  prompt?: string
  templateJson: unknown
}

const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.2'

const MIME_BY_EXTENSION: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  markdown: 'text/markdown',
  md: 'text/markdown',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
}

let client: OpenAIClient | null = null

function getApiKey() {
  const apiKey =
    import.meta.env.VITE_OPENAI_API_KEY?.trim() || import.meta.env.VITE_OPENAI_SECRET_KEY?.trim()

  if (!apiKey) {
    throw new Error(
      'Missing `VITE_OPENAI_API_KEY`. Add it to your Vite environment before generating a diagram.',
    )
  }

  return apiKey
}

function getClient() {
  client ??= new OpenAIClient({
    apiKey: getApiKey(),
    dangerouslyAllowBrowser: true,
  })

  return client
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

async function fileToBase64(file: File) {
  return arrayBufferToBase64(await file.arrayBuffer())
}

function isImageFile(file: File) {
  if (file.type.startsWith('image/')) {
    return true
  }

  const extension = getExtension(file.name)
  return extension === 'png' || extension === 'jpg' || extension === 'jpeg'
}

function getMimeType(file: File) {
  if (file.type.trim()) {
    return file.type
  }

  const extension = getExtension(file.name)
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

async function buildImageAttachmentContent(file: File): Promise<ResponseInputImage> {
  const base64 = await fileToBase64(file)
  const mimeType = getMimeType(file)
  const dataUrl = `data:${mimeType};base64,${base64}`

  return {
    type: 'input_image',
    image_url: dataUrl,
    detail: 'auto',
  }
}

async function buildFileAttachmentContent(file: File): Promise<ResponseInputFile> {
  const base64 = await fileToBase64(file)
  const mimeType = getMimeType(file)
  const dataUrl = `data:${mimeType};base64,${base64}`

  return {
    type: 'input_file',
    filename: file.name,
    file_data: dataUrl,
  }
}

export async function buildOpenAIUserContent(
  prompt: string,
  attachments: File[] = [],
): Promise<ResponseInputContent[]> {
  const imageAttachments = attachments.filter(isImageFile)
  const fileAttachments = attachments.filter((file) => !isImageFile(file))
  const textContent: ResponseInputText = {
    type: 'input_text',
    text: prompt.trim(),
  }

  return [
    textContent,
    ...(await Promise.all(fileAttachments.map(buildFileAttachmentContent))),
    ...(await Promise.all(imageAttachments.map(buildImageAttachmentContent))),
  ]
}

export async function createOpenAIResponse({
  attachments = [],
  model = DEFAULT_MODEL,
  prompt,
  systemInstructions,
  text,
}: CreateOpenAIResponseParams) {
  const input: ResponseInput = []

  if (systemInstructions?.trim()) {
    input.push({
      role: 'system',
      content: systemInstructions.trim(),
    })
  }

  input.push({
    role: 'user',
    content: await buildOpenAIUserContent(prompt, attachments),
  })

  return getClient().responses.create({
    model,
    input,
    ...(text ? { text } : {}),
  })
}

function buildSlideTextOnlyPrompt(templateJson: unknown, prompt?: string) {
  const userContext = prompt?.trim()

  return [
    userContext
      ? `Use this user request as additional guidance:\n${userContext}`
      : 'Use the attached technical information to update the slide text values.',
    'Return the full resulting JSON object after editing only allowed text values.',
    'Base PowerPoint architecture diagram JSON:',
    JSON.stringify(templateJson, null, 2),
  ].join('\n\n')
}

export async function generateSlidePromptOutput({
  attachments = [],
  prompt,
  templateJson,
}: GenerateSlidePromptOutputParams): Promise<SlidePromptOutput> {
  const response = await createOpenAIResponse({
    attachments,
    prompt: buildSlideTextOnlyPrompt(templateJson, prompt),
    systemInstructions: slideTextOnlyInstructions,
    text: {
      format: {
        type: 'json_schema',
        ...SLIDE_PROMPT_OUTPUT_FORMAT,
      },
    },
  })

  if (response.output_text) {
    return JSON.parse(response.output_text) as SlidePromptOutput
  }

  throw new Error('OpenAI did not return a structured slide JSON payload.')
}
