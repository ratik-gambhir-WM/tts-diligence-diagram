import { AppNav } from '../components/AppNav'
import { PageShell } from '../components/PageShell'
import { TemplatePicker } from '../components/TemplatePicker'
import type { PickerTemplateSummary } from '../lib/api/templateApi'

type CommentaryPickerProps = {
  error: string
  isSubmitting: boolean
  onOpenInputPage: () => void
  onOpenJsonInput: () => void
  onSelectTemplate: (template: PickerTemplateSummary, signal: AbortSignal) => Promise<void>
}

export function CommentaryPicker({
  error,
  isSubmitting,
  onOpenInputPage,
  onOpenJsonInput,
  onSelectTemplate,
}: CommentaryPickerProps) {
  return (
    <PageShell>
      <AppNav
        activePage="commentary"
        onOpenInputPage={onOpenInputPage}
        onOpenJsonInput={onOpenJsonInput}
      />
      <TemplatePicker
        kind="commentary"
        defaultTemplateId="security-ssa"
        previewLabel="Commentary Preview"
        relatedLabel="Related Commentary"
        selectLabel="Open in Canvas"
        error={error}
        isActionPending={isSubmitting}
        onSelectTemplate={onSelectTemplate}
      />
    </PageShell>
  )
}
