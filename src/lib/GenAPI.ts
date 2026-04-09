import OpenAI from 'openai'
import type { ResponseInput, ResponseInputContent } from 'openai/resources/responses/responses'

import diagramInstructions from '../prompts/JsonDiagramPrompt.md?raw'
import style from '..prompts/context/WMStyleGuide.md'
import { PROMPT_OUTPUT_FORMAT } from '../types/PromptOutput'
import type { PromptOutput } from '../types/PromptOutput'
import { getExtension } from '../utils/files'

type GenerateDiagramOutputParams = {
  attachments?: File[]
  prompt: string
}

const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.4'

let client: OpenAI | null = null

function getApiKey() {
  const apiKey =
    import.meta.env.VITE_OPENAI_API_KEY?.trim() || import.meta.env.VITE_OPENAI_SECRET_KEY?.trim()

  // if (!apiKey) {
  //   throw new Error(
  //     'Missing `VITE_OPENAI_API_KEY`. Add it to your Vite environment before generating a diagram.',
  //   )
  // }

  return apiKey ?? "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"
}

function getClient() {
  client ??= new OpenAI({
    apiKey: getApiKey(),
    dangerouslyAllowBrowser: true,
  })

  return client
}

function buildUserInput(prompt: string, attachments: File[]) {
  const sections = [`Architecture prompt:\n${prompt.trim()}`]

  if (attachments.length > 0) {
    sections.push(`Attached assets: ${attachments.length}. Use the attached file/image contents as part of the analysis.`)
  }

  return sections.join('\n\n')
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
      detail: 'auto',
      image_url: dataUrl,
    }
  }

  return {
    type: 'input_file',
    filename: file.name,
    file_data: dataUrl,
  }
}

async function buildResponseInput(prompt: string, attachments: File[]): Promise<ResponseInput> {
  const content: ResponseInputContent[] = [
    {
      type: 'input_text',
      text: buildUserInput(prompt, attachments),
    },
    ...(await Promise.all(attachments.map(buildAttachmentContent))),
  ]

  return [
    {
      type: 'message',
      role: 'user',
      content,
    },
  ]
}

export async function generateDiagramOutput({
  attachments = [],
  prompt,
}: GenerateDiagramOutputParams): Promise<PromptOutput> {

  const diagramPrompt = await loadPrompt()

  const response = await getClient().responses.parse({
    model: DEFAULT_MODEL,
    instructions: diagramInstructions,
    input: await buildResponseInput(diagramPrompt, attachments),
    text: {
      format: PROMPT_OUTPUT_FORMAT,
    },
  })

  if (response.output_parsed) {
    return response.output_parsed as PromptOutput
  }

  if (response.output_text) {
    return JSON.parse(response.output_text) as PromptOutput
  }

  throw new Error('OpenAI did not return a structured diagram payload.')
}


async function loadPrompt() {
   //loads in style guides and context into prompt if files are available
  let prompt = diagramInstructions;
  const guide = fs.existsSync('./WMStyleGuide.md') ? fs.readFileSync('./WMStyleGuide.md', 'utf8').trim() : '';
  return prompt.replace('$SELECTION_PLACEHOLDER$', guide || '');
}
