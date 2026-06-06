import type { ChangeEvent } from 'react'

import { formatFileSize } from '../utils/files'
import { AppNav } from './AppNav'
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
  onOpenInputPage: () => void
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
  onOpenInputPage,
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
    <main className="flex min-h-screen flex-col bg-[#070a1b] p-8 text-[#eef3ff] max-[640px]:p-4">
      <AppNav
        activePage="diagramming"
        onOpenDiagramPicker={onOpenDiagramPicker}
        onOpenInputPage={onOpenInputPage}
      />

      <div className="grid min-h-0 flex-1 place-items-center pt-8">
      <section className="relative w-full max-w-[780px] overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b0f24] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.34)] max-[640px]:rounded-[1.5rem] max-[640px]:p-5">
        <div className="pointer-events-none absolute inset-0 opacity-45">
          <div className="absolute left-[-10%] top-14 h-px w-[120%] rotate-12 bg-white/8" />
          <div className="absolute left-[-10%] top-48 h-px w-[120%] -rotate-6 bg-white/8" />
          <div className="absolute left-24 top-[-20%] h-[140%] w-px rotate-[-18deg] bg-white/8" />
          <div className="absolute right-24 top-[-20%] h-[140%] w-px rotate-[24deg] bg-white/8" />
        </div>

        <div className="relative mx-auto flex flex-wrap items-center justify-center gap-5">
          <WestMonroeMark className="h-20 w-20 max-[480px]:h-16 max-[480px]:w-16 [&_rect]:fill-[#f3c316]" />
          <span
            className="whitespace-nowrap text-[3rem] font-bold leading-none tracking-normal text-white max-[480px]:text-[2rem]"
          >
            west monroe
          </span>
        </div>

        <div
          className="relative mt-8 flex flex-wrap items-center justify-center gap-3"
          data-selected-diagram-id={selectedArchitectureDiagramId}
        >
          <label
            className={`border border-[#28304a] bg-[#080c1c] px-4 py-2.5 text-[0.9rem] font-bold tracking-[0.12em] text-[#eef3ff] uppercase transition duration-150 ease-out hover:border-[#f3c316] ${
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
            className="cursor-pointer border border-[#f3c316] bg-[#f3c316] px-4 py-2.5 text-[0.9rem] font-bold tracking-[0.12em] text-[#070a1b] uppercase transition duration-150 ease-out hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploadOnlySelecting ? 'Selecting...' : 'Submit files'}
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
          <p className="relative mt-3 text-center text-[0.92rem] leading-5 text-[#ffb5b5]">{uploadOnlyError}</p>
        )}

        {uploadOnlyFiles.length > 0 && (
          <div className="relative mt-6 border-t border-white/12 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-[0.82rem] font-bold tracking-[0.12em] text-[#8d93aa] uppercase">
              <span>Added files</span>
              <span>
                {uploadOnlyFiles.length} file{uploadOnlyFiles.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="grid gap-2" aria-label="Added files">
              {uploadOnlyFiles.map((file, index) => (
                <li
                  className="flex min-w-0 items-center justify-between gap-3 border border-[#28304a] bg-[#080c1c] px-3 py-2 text-left"
                  key={`${file.name}-${file.size}-${index}`}
                >
                  <span className="min-w-0 truncate text-[0.9rem] font-bold text-[#eef3ff]">{file.name}</span>
                  <span className="shrink-0 text-[0.8rem] font-bold text-[#8d93aa]">
                    {formatFileSize(file.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      </div>
    </main>
  )
}
