import type { ChangeEvent } from 'react'

import westMonroeLogo from '../assets/west-monroe-logo.svg'
import { SnailLoader } from './SnailLoader'

type PromptPageProps = {
  acceptAttr: string
  isUploadOnlySelecting: boolean
  onOpenDiagramPicker: () => void
  onUploadOnlyFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadOnlySubmit: () => void
  selectedArchitectureDiagramId: string
  uploadOnlyFileCount: number
  uploadOnlyError: string
}

export function PromptPage({
  acceptAttr,
  isUploadOnlySelecting,
  onOpenDiagramPicker,
  onUploadOnlyFileChange,
  onUploadOnlySubmit,
  selectedArchitectureDiagramId,
  uploadOnlyFileCount,
  uploadOnlyError,
}: PromptPageProps) {
  if (isUploadOnlySelecting) {
    return <SnailLoader />
  }

  return (
    <main className="grid min-h-screen place-items-center p-8 max-[640px]:p-4">
      <section className="w-full max-w-[780px] rounded-[28px] border border-[#171717]/10 bg-white/95 p-6 shadow-[0_28px_90px_rgba(23,23,23,0.12)] backdrop-blur-xl max-[640px]:p-4">
        <img
          src={westMonroeLogo}
          alt="West Monroe"
          className="mx-auto h-auto w-full max-w-[399px]"
        />

        <div
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
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
          <button
            type="button"
            onClick={onUploadOnlySubmit}
            disabled={isUploadOnlySelecting || uploadOnlyFileCount === 0}
            className="cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#f26f21] to-[#c95518] px-4 py-2.5 text-[0.95rem] font-bold text-white shadow-[0_12px_24px_rgba(242,111,33,0.24)] transition duration-150 ease-out hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploadOnlySelecting ? 'Selecting...' : 'Submit files'}
          </button>
          <button
            type="button"
            onClick={onOpenDiagramPicker}
            className="cursor-pointer rounded-full border border-[#171717]/14 bg-white px-4 py-2.5 text-[0.95rem] font-bold text-[#171717] transition duration-150 ease-out hover:border-[#171717] hover:bg-[#f6f6f6]"
          >
            Browse templates
          </button>
          <input
            id="upload-only-attachments"
            name="upload-only-attachments"
            type="file"
            multiple
            accept={acceptAttr}
            onChange={onUploadOnlyFileChange}
            disabled={isUploadOnlySelecting}
            className="sr-only"
          />
        </div>

        {uploadOnlyError && (
          <p className="mt-3 text-center text-[0.92rem] leading-5 text-red-700">{uploadOnlyError}</p>
        )}
      </section>
    </main>
  )
}
