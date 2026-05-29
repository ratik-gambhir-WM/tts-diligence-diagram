import OpenAI from 'openai'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseInput,
  ResponseInputContent,
} from 'openai/resources/responses/responses'

import diagramInstructions from '../prompts/RevisedPrompt.md?raw'
import { PROMPT_OUTPUT_FORMAT } from '../types/PromptOutput'
import type { PromptOutput } from '../types/PromptOutput'
import { getExtension } from '../utils/files'

type GenerateDiagramOutputParams = {
  attachments?: File[]
  prompt: string
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

let client: OpenAI | null = null

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
  client ??= new OpenAI({
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

async function buildAttachmentContent(file: File): Promise<ResponseInputContent> {
  const base64 = await fileToBase64(file)
  const mimeType = getMimeType(file)
  const dataUrl = `data:${mimeType};base64,${base64}`

  if (isImageFile(file)) {
    return {
      type: 'input_image',
      image_url: dataUrl,
      detail: 'high',
    }
  }

  return {
    type: 'input_file',
    filename: file.name,
    file_data: dataUrl,
  }
}

async function buildResponseInput(prompt: string, attachments: File[]): Promise<ResponseInputContent[]> {
  return [
    {
      type: 'input_text',
      text: prompt.trim(),
    },
    ...(await Promise.all(attachments.map(buildAttachmentContent))),
  ]
}

export async function generateDiagramOutput({
  attachments = [],
  prompt,
}: GenerateDiagramOutputParams): Promise<PromptOutput> {
  const input: ResponseInput = [
    {
      role: 'system',
      content: diagramInstructions.trim(),
    },
    {
      role: 'user',
      content: await buildResponseInput(prompt, attachments),
    },
  ]

  const request: ResponseCreateParamsNonStreaming = {
    model: DEFAULT_MODEL,
    input,
    text: {
      format: {
        type: 'json_schema',
        ...PROMPT_OUTPUT_FORMAT,
      },
    },
  }

  const response = await getClient().responses.create(request)

  if (response.output_text) {
    const parsedPromptOutput = JSON.parse(response.output_text) as PromptOutput
    console.log("Prompt output: ", parsedPromptOutput)
    return parsedPromptOutput
  }

  throw new Error('OpenAI did not return a structured diagram payload.')
}
