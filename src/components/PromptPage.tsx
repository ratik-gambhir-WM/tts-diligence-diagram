import type { ChangeEvent } from 'react'

import { formatFileSize } from '../utils/files'
import { SnailLoader } from './SnailLoader'
import { WestMonroeMark } from './WestMonroeMark'

type UploadOnlyFile = {
  name: string
  size: number
}

type PromptPageProps = {
  acceptAttr: string
  isUploadOnlySelecting: boolean
  onOpenDiagramPicker: () => void
  onUploadOnlyFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadOnlySubmit: () => void
  selectedArchitectureDiagramId: string
  uploadOnlyFiles: UploadOnlyFile[]
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
  uploadOnlyFiles,
  uploadOnlyFileCount,
  uploadOnlyError,
}: PromptPageProps) {
  if (isUploadOnlySelecting) {
    return <SnailLoader />
  }

  return (
    <main className="grid min-h-screen place-items-center p-8 max-[640px]:p-4">
      <section className="w-full max-w-[780px] rounded-[28px] border border-[#171717]/10 bg-white/95 p-6 shadow-[0_28px_90px_rgba(23,23,23,0.12)] backdrop-blur-xl max-[640px]:p-4">
        <div className="mx-auto flex flex-wrap items-center justify-center gap-5">
          <WestMonroeMark className="h-20 w-20 max-[480px]:h-16 max-[480px]:w-16" />
          <span
            className="whitespace-nowrap text-[3rem] font-bold leading-none tracking-normal text-[#040047] max-[480px]:text-[2rem]"
            style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
          >
            west monroe
          </span>
        </div>

        <div
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
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

        {uploadOnlyFiles.length > 0 && (
          <div className="mt-6 border-t border-[#171717]/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-[0.82rem] font-bold text-[#171717]/65">
              <span>Added files</span>
              <span>
                {uploadOnlyFiles.length} file{uploadOnlyFiles.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="grid gap-2" aria-label="Added files">
              {uploadOnlyFiles.map((file, index) => (
                <li
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#171717]/10 bg-[#f7f8fb] px-3 py-2 text-left"
                  key={`${file.name}-${file.size}-${index}`}
                >
                  <span className="min-w-0 truncate text-[0.9rem] font-bold text-[#171717]">{file.name}</span>
                  <span className="shrink-0 text-[0.8rem] font-bold text-[#171717]/55">
                    {formatFileSize(file.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  )
}
