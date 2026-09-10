import type { ChangeEvent } from 'react'

import { AppNav } from '../components/AppNav'
import { FileList } from '../components/FileList'
import { FileUploadButton } from '../components/FileUploadButton'
import { PageShell } from '../components/PageShell'
import { TemplatePicker } from '../components/TemplatePicker'
import type { PickerTemplateSummary } from '../lib/api/templateApi'

type SlidePickerPageProps = {
  acceptAttr: string
  attachmentCountLabel: string
  attachments: File[]
  error: string
  isSubmitting: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenCommentaryPicker: () => void
  onOpenInputPage: () => void
  onOpenJsonInput: () => void
  onRemoveAttachment: (index: number) => void
  onSelectTemplate: (template: PickerTemplateSummary, signal: AbortSignal) => Promise<void>
  renderFileSize: (bytes: number) => string
}

export function SlidePickerPage({
  acceptAttr,
  attachmentCountLabel,
  attachments,
  error,
  isSubmitting,
  onFileChange,
  onOpenCommentaryPicker,
  onOpenInputPage,
  onOpenJsonInput,
  onRemoveAttachment,
  onSelectTemplate,
  renderFileSize,
}: SlidePickerPageProps) {
  return (
    <PageShell>
      <AppNav
        activePage="diagramming"
        onOpenCommentaryPicker={onOpenCommentaryPicker}
        onOpenInputPage={onOpenInputPage}
        onOpenJsonInput={onOpenJsonInput}
      />
      <TemplatePicker
        kind="diagram"
        defaultTemplateId="layered-platform"
        previewLabel="Selection Preview"
        relatedLabel="Related Diagrams"
        selectLabel="Generate Slide"
        error={error}
        isActionPending={isSubmitting}
        onSelectTemplate={onSelectTemplate}
        actionContent={
          <div>
            <FileUploadButton
              id="diagram-context-files"
              accept={acceptAttr}
              onChange={onFileChange}
              disabled={isSubmitting}
              className="px-5 py-3 text-[0.9rem]"
            >
              Add Context Files
            </FileUploadButton>
            <p className="mt-2 text-[0.9rem] text-[#8d93aa]">{attachmentCountLabel}</p>
            <FileList
              files={attachments}
              formatFileSize={renderFileSize}
              label="Diagram context files"
              onRemove={onRemoveAttachment}
              removeDisabled={isSubmitting}
            />
          </div>
        }
      />
    </PageShell>
  )
}
