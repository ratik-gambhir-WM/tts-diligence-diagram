import { useState } from 'react'
import type { ChangeEvent } from 'react'

import { getExtension } from '../utils/files'

export type AttachmentMode = 'template-context' | 'upload-only'

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

export const ACCEPT_ATTR = [
  '.docx',
  '.ppt',
  '.rtf',
  '.pdf',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.md',
  '.markdown',
  '.txt',
  'text/plain',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

type AttachmentRecord = {
  file: File
  mode: AttachmentMode
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
    ? `Unsupported file type: ${fileNames.join(', ')}. Allowed: DOCX, PDF, PPT/PPTX, PNG/JPG, Markdown, TXT.`
    : ''
}

export function useDiagramSession() {
  const [attachmentRecords, setAttachmentRecords] = useState<AttachmentRecord[]>([])
  const [error, setError] = useState('')

  const attachments = attachmentRecords.map((attachment) => attachment.file)
  const uploadOnlyAttachments = attachmentRecords
    .filter((attachment) => attachment.mode === 'upload-only')
    .map((attachment) => attachment.file)

  const attachmentCountLabel = getAttachmentCountLabel(attachments.length)

  function handleFiles(event: ChangeEvent<HTMLInputElement>, mode: AttachmentMode = 'template-context') {
    const incomingFiles = Array.from(event.target.files ?? [])

    if (incomingFiles.length === 0) {
      return []
    }

    const { invalidFileNames, validAttachments } = partitionAttachments(incomingFiles)

    if (validAttachments.length > 0) {
      setAttachmentRecords((previousAttachments) => [
        ...previousAttachments,
        ...validAttachments.map((file) => ({ file, mode })),
      ])
    }

    setError(formatUnsupportedFilesMessage(invalidFileNames))

    event.target.value = ''

    return validAttachments
  }

  function removeAttachment(index: number) {
    setAttachmentRecords((previousAttachments) =>
      previousAttachments.filter((_, currentIndex) => currentIndex !== index),
    )
  }

  function removeUploadOnlyAttachment(index: number) {
    setAttachmentRecords((previousAttachments) => {
      let uploadOnlyIndex = -1

      return previousAttachments.filter((attachment) => {
        if (attachment.mode !== 'upload-only') {
          return true
        }

        uploadOnlyIndex += 1
        return uploadOnlyIndex !== index
      })
    })
  }

  return {
    attachmentCountLabel,
    attachments,
    error,
    handleFiles,
    removeAttachment,
    removeUploadOnlyAttachment,
    uploadOnlyAttachments,
  }
}
