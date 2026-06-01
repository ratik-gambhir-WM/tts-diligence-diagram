import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { ALLOWED_EXTENSIONS, buildInitialGraph } from '../lib/diagram'
import { generateDiagramOutput } from '../lib/GenAPI'
import type { PromptOutput } from '../types/PromptOutput'
import { getExtension } from '../utils/files'

const DIAGRAM_SESSION_STORAGE_KEY = 'tts-mermaid.diagram-session'

export type AttachmentMode = 'prompt' | 'upload-only'

type AttachmentRecord = {
  file: File
  mode: AttachmentMode
}

type StoredDiagramSession = {
  message: string
  promptOutput: PromptOutput | null
  submittedMessage: string
}

type UseDiagramSessionParams = {
  onGenerated: () => void
}

const EMPTY_STORED_SESSION: StoredDiagramSession = {
  message: '',
  promptOutput: null,
  submittedMessage: '',
}

function createEmptyStoredDiagramSession(): StoredDiagramSession {
  return { ...EMPTY_STORED_SESSION }
}

function readStoredDiagramSession(): StoredDiagramSession {
  if (typeof window === 'undefined') {
    return createEmptyStoredDiagramSession()
  }

  const storedValue = window.localStorage.getItem(DIAGRAM_SESSION_STORAGE_KEY)

  if (!storedValue) {
    return createEmptyStoredDiagramSession()
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<StoredDiagramSession>

    return {
      message: typeof parsed.message === 'string' ? parsed.message : '',
      promptOutput: parsed.promptOutput ?? null,
      submittedMessage: typeof parsed.submittedMessage === 'string' ? parsed.submittedMessage : '',
    }
  } catch {
    return createEmptyStoredDiagramSession()
  }
}

function persistStoredDiagramSession(session: StoredDiagramSession) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      DIAGRAM_SESSION_STORAGE_KEY,
      JSON.stringify(session satisfies StoredDiagramSession),
    )
  } catch {
    // Ignore storage write failures so the prompt flow still works in restricted environments.
  }
}

function getAttachmentCountLabel(count: number) {
  if (count === 0) return 'No files attached'
  if (count === 1) return '1 file attached'
  return `${count} files attached`
}

function partitionAttachments(files: File[]) {
  const validAttachments: File[] = []
  const invalidFileNames: string[] = []

  for (const file of files) {
    const ext = getExtension(file.name)

    if (ALLOWED_EXTENSIONS.has(ext)) {
      validAttachments.push(file)
    } else {
      invalidFileNames.push(file.name)
    }
  }

  return { invalidFileNames, validAttachments }
}

function formatUnsupportedFilesMessage(fileNames: string[]) {
  return fileNames.length > 0
    ? `Unsupported file type: ${fileNames.join(', ')}. Allowed: PDF, PPT/PPTX, PNG/JPG, Markdown, TXT.`
    : ''
}

export function useDiagramSession({ onGenerated }: UseDiagramSessionParams) {
  const [session, setSession] = useState<StoredDiagramSession>(() => readStoredDiagramSession())
  const [attachmentRecords, setAttachmentRecords] = useState<AttachmentRecord[]>([])
  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>('prompt')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { message, promptOutput, submittedMessage } = session
  const attachments = attachmentRecords.map((attachment) => attachment.file)
  const promptAttachments = attachmentRecords
    .filter((attachment) => attachment.mode === 'prompt')
    .map((attachment) => attachment.file)
  const uploadOnlyAttachments = attachmentRecords
    .filter((attachment) => attachment.mode === 'upload-only')
    .map((attachment) => attachment.file)

  useEffect(() => {
    persistStoredDiagramSession(session)
  }, [session])

  const attachmentCountLabel = getAttachmentCountLabel(attachments.length)

  function handleFiles(event: ChangeEvent<HTMLInputElement>, mode: AttachmentMode = 'prompt') {
    const incomingFiles = Array.from(event.target.files ?? [])

    if (incomingFiles.length === 0) {
      return []
    }

    const { invalidFileNames, validAttachments } = partitionAttachments(incomingFiles)

    if (validAttachments.length > 0) {
      setAttachmentMode(mode)
      setAttachmentRecords((previousAttachments) => [
        ...previousAttachments,
        ...validAttachments.map((file) => ({ file, mode })),
      ])
    }

    setError(formatUnsupportedFilesMessage(invalidFileNames))

    event.target.value = ''

    return validAttachments
  }

  function handleMessageChange(value: string) {
    setSession((currentSession) => ({
      ...currentSession,
      message: value,
    }))
    setError('')
  }

  function handleSubmittedMessageChange(value: string) {
    setSession((currentSession) => ({
      ...currentSession,
      message: value,
      submittedMessage: value,
    }))
  }

  function removeAttachment(index: number) {
    setAttachmentRecords((previousAttachments) =>
      previousAttachments.filter((_, currentIndex) => currentIndex !== index),
    )
  }

  function handleGraphBuildError(errorMessage: string) {
    setSession((currentSession) => ({
      ...currentSession,
      promptOutput: null,
      submittedMessage: '',
    }))
    setError(errorMessage)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!message.trim()) {
      setError('Enter some prompt text before opening the canvas.')
      return
    }

    const trimmedMessage = message.trim()

    setError('')
    setIsSubmitting(true)

    try {
      const generatedOutput = await generateDiagramOutput({
        prompt: trimmedMessage,
        attachments: promptAttachments,
      })
      buildInitialGraph(generatedOutput)

      setSession((currentSession) => ({
        ...currentSession,
        message: trimmedMessage,
        promptOutput: generatedOutput,
        submittedMessage: trimmedMessage,
      }))
      onGenerated()
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Failed to generate a diagram from the prompt.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    attachmentMode,
    attachmentCountLabel,
    attachments,
    error,
    handleGraphBuildError,
    handleFiles,
    handleMessageChange,
    handleSubmit,
    isSubmitting,
    message,
    promptOutput,
    promptAttachments,
    removeAttachment,
    submittedMessage,
    updateSubmittedMessage: handleSubmittedMessageChange,
    uploadOnlyAttachments,
  }
}
