import type { ChangeEvent, FormEvent } from 'react'

import { SnailLoader } from './SnailLoader'
import type { AttachmentMode } from '../hooks/useDiagramSession'

type PromptPageProps = {
  acceptAttr: string
  attachmentMode: AttachmentMode
  attachmentCountLabel: string
  attachments: File[]
  error: string
  isSubmitting: boolean
  isUploadOnlySelecting: boolean
  message: string
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onMessageChange: (value: string) => void
  onOpenDiagramPicker: () => void
  onRemoveAttachment: (index: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUploadOnlyFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadOnlySubmit: () => void
  renderFileSize: (bytes: number) => string
  selectedArchitectureDiagramId: string
  uploadOnlyFileCount: number
  uploadOnlyError: string
}

export function PromptPage({
  acceptAttr,
  attachmentMode,
  attachmentCountLabel,
  attachments,
  error,
  isSubmitting,
  isUploadOnlySelecting,
  message,
  onFileChange,
  onMessageChange,
  onOpenDiagramPicker,
  onRemoveAttachment,
  onSubmit,
  onUploadOnlyFileChange,
  onUploadOnlySubmit,
  renderFileSize,
  selectedArchitectureDiagramId,
  uploadOnlyFileCount,
  uploadOnlyError,
}: PromptPageProps) {
  if (isSubmitting || isUploadOnlySelecting) {
    return <SnailLoader />
  }

  return (
    <main className="grid min-h-screen place-items-center p-8 max-[640px]:p-4">
      <section className="w-full max-w-[780px] rounded-[28px] border border-[#171717]/10 bg-white/95 p-6 shadow-[0_28px_90px_rgba(23,23,23,0.12)] backdrop-blur-xl max-[640px]:p-4">
        <header>
          <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[#c95518]">Diagram Prompt</p>
          <h1 className="m-0 text-[clamp(1.8rem,4vw,3rem)] leading-[1.05]">Architecture Input</h1>
          <p className="mt-3 max-w-[42rem] text-[#4f4f4f]">
            Enter any prompt text, then jump into a canvas-based React Flow diagram page.
          </p>
        </header>

        <form className="mt-6" onSubmit={onSubmit} data-attachment-mode={attachmentMode}>
          <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-5 max-[640px]:grid-cols-1 max-[640px]:gap-4">
            <div>
              <label htmlFor="message" className="sr-only">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                disabled={isSubmitting}
                placeholder="Sketch a payment platform with an API gateway, worker queue, and reporting database."
                rows={4}
                spellCheck={false}
                className="min-h-[130px] w-full resize-y rounded-[20px] border border-[#171717]/12 bg-white px-[1.1rem] py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#f26f21] focus:outline-[3px] focus:outline-[#f26f21]/20"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label
                  className="cursor-pointer rounded-full border-0 bg-[#171717] px-4 py-2.5 text-[0.95rem] font-bold text-white transition duration-150 ease-out hover:bg-[#2a2a2a]"
                  htmlFor="attachments"
                >
                  Attach files
                </label>
                <span className="text-[0.92rem] text-[#5c5c5c]">{attachmentCountLabel}</span>
              </div>
            </div>

            <div className="bg-[#171717]/12 max-[640px]:h-px max-[640px]:w-full" aria-hidden="true" />

            <div
              className="flex min-h-[130px] flex-col items-center justify-center gap-3"
              data-selected-diagram-id={selectedArchitectureDiagramId}
            >
              <label
                className={`rounded-full border-0 bg-[#171717] px-4 py-2.5 text-[0.95rem] font-bold text-white transition duration-150 ease-out hover:bg-[#2a2a2a] ${
                  isUploadOnlySelecting ? 'cursor-wait opacity-70' : 'cursor-pointer'
                }`}
                htmlFor="upload-only-attachments"
                aria-disabled={isUploadOnlySelecting}
              >
                {isUploadOnlySelecting ? 'Selecting...' : 'Upload file'}
              </label>
              {uploadOnlyError && (
                <p className="m-0 text-center text-[0.82rem] leading-5 text-red-700">{uploadOnlyError}</p>
              )}
              <button
                type="button"
                onClick={onUploadOnlySubmit}
                disabled={isSubmitting || isUploadOnlySelecting || uploadOnlyFileCount === 0}
                className="cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#f26f21] to-[#c95518] px-4 py-2.5 text-[0.95rem] font-bold text-white shadow-[0_12px_24px_rgba(242,111,33,0.24)] transition duration-150 ease-out hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploadOnlySelecting ? 'Selecting...' : 'Submit files'}
              </button>
            </div>
            <input
              id="attachments"
              name="attachments"
              type="file"
              multiple
              accept={acceptAttr}
              onChange={onFileChange}
              disabled={isSubmitting}
              className="sr-only"
            />
            <input
              id="upload-only-attachments"
              name="upload-only-attachments"
              type="file"
              multiple
              accept={acceptAttr}
              onChange={onUploadOnlyFileChange}
              disabled={isSubmitting || isUploadOnlySelecting}
              className="sr-only"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenDiagramPicker}
              className="cursor-pointer rounded-full border border-[#171717]/14 bg-white px-4 py-2.5 text-[0.95rem] font-bold text-[#171717] transition duration-150 ease-out hover:border-[#171717] hover:bg-[#f6f6f6]"
            >
              Browse templates
            </button>
            <button
              type="submit"
              className="ml-auto cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#f26f21] to-[#c95518] px-4 py-2.5 text-[0.95rem] font-bold text-white shadow-[0_12px_24px_rgba(242,111,33,0.28)] transition duration-150 ease-out hover:-translate-y-px disabled:cursor-not-allowed max-[640px]:ml-0"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Generating...' : 'Open canvas'}
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-red-700">{error}</p>}

        {attachments.length > 0 && (
          <ul className="mt-4 grid list-none gap-2 p-0" aria-label="Attached files">
            {attachments.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-2 rounded-[14px] border border-[#171717]/10 bg-[#fafafa] px-3 py-2.5"
              >
                <span>
                  {file.name} ({renderFileSize(file.size)})
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(index)}
                  disabled={isSubmitting}
                  className="cursor-pointer border-0 bg-transparent font-bold text-[#171717] transition hover:text-[#c95518]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
