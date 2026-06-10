import type { ChangeEvent } from 'react'

import { AppNav } from '../components/AppNav'
import { BrandLockup } from '../components/BrandLockup'
import { Button } from '../components/Button'
import { FileList } from '../components/FileList'
import { FileUploadButton } from '../components/FileUploadButton'
import { PageShell } from '../components/PageShell'
import { SnailLoader } from '../components/SnailLoader'
import { StudioPanel } from '../components/StudioPanel'
import { formatFileSize } from '../utils/files'

type UploadOnlyFile = {
  name: string
  size: number
}

type PromptPageProps = {
  acceptAttr: string
  createMode: boolean
  isUploadOnlySelecting: boolean
  onOpenDiagramPicker: () => void
  onOpenInputPage: () => void
  onOpenJsonInput: () => void
  onCreateModeChange: (createMode: boolean) => void
  onUploadOnlyFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadOnlySubmit: () => void
  selectedArchitectureDiagramId: string
  uploadOnlyFiles: UploadOnlyFile[]
  uploadOnlyFileCount: number
  uploadOnlyError: string
}

export function PromptPage({
  acceptAttr,
  createMode,
  isUploadOnlySelecting,
  onOpenDiagramPicker,
  onOpenInputPage,
  onOpenJsonInput,
  onCreateModeChange,
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
    <PageShell>
      <AppNav
        activePage="diagramming"
        onOpenDiagramPicker={onOpenDiagramPicker}
        onOpenInputPage={onOpenInputPage}
        onOpenJsonInput={onOpenJsonInput}
      />

      <div className="grid min-h-0 flex-1 place-items-center pt-8">
        <StudioPanel className="w-full max-w-[780px] max-[640px]:rounded-[1.5rem] max-[640px]:p-5">
          <label className="absolute top-5 right-5 z-10 flex cursor-pointer items-center gap-2 text-[0.72rem] font-bold tracking-[0.14em] text-[#eef3ff] uppercase">
            <span>Create</span>
            <span
              className={[
                'relative h-6 w-11 rounded-full border transition',
                createMode ? 'border-[#f3c316] bg-[#f3c316]' : 'border-[#28304a] bg-[#080c1c]',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                aria-label="Create a new diagram from uploaded files"
                type="checkbox"
                checked={createMode}
                onChange={(event) => onCreateModeChange(event.currentTarget.checked)}
                disabled={isUploadOnlySelecting}
                className="sr-only"
              />
              <span
                className={[
                  'absolute top-1 h-4 w-4 rounded-full bg-white transition',
                  createMode ? 'left-6' : 'left-1',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </span>
          </label>

          <BrandLockup align="center" markSize="lg" title="west monroe" />

          <div
            className="relative mt-8 flex flex-wrap items-center justify-center gap-3"
            data-selected-diagram-id={selectedArchitectureDiagramId}
          >
            <FileUploadButton
              id="upload-only-attachments"
              accept={acceptAttr}
              onChange={onUploadOnlyFileChange}
              disabled={isUploadOnlySelecting}
              variant="secondary"
              className="px-4 py-2.5 text-[0.9rem]"
            >
              {isUploadOnlySelecting ? 'Selecting...' : 'Upload file'}
            </FileUploadButton>
            <Button
              type="button"
              onClick={onUploadOnlySubmit}
              disabled={isUploadOnlySelecting || uploadOnlyFileCount === 0}
              variant="primary"
              className="px-4 py-2.5 text-[0.9rem] disabled:opacity-50"
            >
              {isUploadOnlySelecting ? 'Working...' : createMode ? 'Create diagram' : 'Submit files'}
            </Button>
          </div>

          {uploadOnlyError && (
            <p className="relative mt-3 text-center text-[0.92rem] leading-5 text-[#ffb5b5]">
              {uploadOnlyError}
            </p>
          )}

          <FileList
            files={uploadOnlyFiles}
            formatFileSize={formatFileSize}
            label="Added files"
            showCountHeader
          />
        </StudioPanel>
      </div>
    </PageShell>
  )
}
