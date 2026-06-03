import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { DiagramPicker } from './components/DiagramPicker'
import { PromptPage } from './components/PromptPage'
import { ACCEPT_ATTR } from './lib/diagram'
import { getDefaultDiagramTemplate, type DiagramTemplate } from './lib/diagramTemplates'
import { generatePowerPointFromJson } from './lib/export/exporter'
import {
  getSelectedArchitectureTemplate,
  selectArchitectureDiagramModel,
} from './lib/modelSelector'
import { generateSlidePromptOutput } from './lib/OpenAI'
import { SlideFlowCanvas } from './lib/slide-flow'
import { useDiagramSession } from './hooks/useDiagramSession'
import type { ModelSelectorOutput } from './types/ModelSelectorOutput'
import { formatFileSize } from './utils/files'

const EXPORTER_ROUTE = '/'
const DIAGRAM_PICKER_ROUTE = '/diagram-picker'
const DIAGRAM_CANVAS_ROUTE = '/diagram-template'

export default function App() {
  const navigate = useNavigate()
  const [canvasTemplate, setCanvasTemplate] = useState<DiagramTemplate>(() => getDefaultDiagramTemplate())
  const [templateStatusMessage, setTemplateStatusMessage] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false)
  const [modelSelection, setModelSelection] = useState<ModelSelectorOutput | null>(null)
  const [modelSelectorError, setModelSelectorError] = useState('')
  const [isModelSelecting, setIsModelSelecting] = useState(false)
  const [isTemplateJsonOpenOnLoad, setIsTemplateJsonOpenOnLoad] = useState(false)
  const {
    attachmentCountLabel,
    attachments,
    error,
    handleFiles,
    removeAttachment,
    uploadOnlyAttachments,
  } = useDiagramSession()

  function handleUploadOnlyFileChange(event: ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = handleFiles(event, 'upload-only')

    if (uploadedFiles.length === 0) {
      return
    }

    setModelSelection(null)
    setModelSelectorError('')
  }

  async function handleUploadOnlySubmit() {
    if (uploadOnlyAttachments.length === 0) {
      setModelSelectorError('Upload at least one file before submitting.')
      return
    }

    setModelSelectorError('')
    setIsModelSelecting(true)

    try {
      const selection = await selectArchitectureDiagramModel({ uploadedFiles: uploadOnlyAttachments })
      console.log("SELECTION: ")
      console.log(selection);
      const selectedTemplate = getSelectedArchitectureTemplate(selection)

      if (!selectedTemplate) {
        throw new Error(`No template JSON found for selected diagram id: ${selection.selectedDiagramId}`)
      }

      const generatedSlideJson = await generateSlidePromptOutput({
        attachments: uploadOnlyAttachments,
        templateJson: selectedTemplate.jsonSpec,
        prompt: [
          `Selected template: ${selectedTemplate.name}.`,
          'Use the attached technical context files to update the architecture diagram text.',
          'Keep the template layout and all non-text JSON values unchanged.',
        ].join(' '),
      })

      setModelSelection(selection)
      setCanvasTemplate({
        ...selectedTemplate,
        jsonSpec: generatedSlideJson,
      })
      setTemplateStatusMessage(
        `Generated ${selectedTemplate.name} from uploaded diligence material.`,
      )
      setIsTemplateJsonOpenOnLoad(true)
      navigate(DIAGRAM_CANVAS_ROUTE)
    } catch (selectionError) {
      setModelSelectorError(
        selectionError instanceof Error
          ? selectionError.message
          : 'Failed to select an architecture diagram.',
      )
    } finally {
      setIsModelSelecting(false)
    }
  }

  async function handleSubmitTemplate(template: DiagramTemplate) {
    setTemplateError('')
    setIsTemplateJsonOpenOnLoad(false)
    setIsTemplateSubmitting(true)

    try {
      const generatedSlideJson = await generateSlidePromptOutput({
        attachments,
        templateJson: template.jsonSpec,
        prompt: [
          `Selected template: ${template.name}.`,
          'Use the attached technical context files to update the architecture diagram text.',
          'Keep the template layout and all non-text JSON values unchanged.',
        ].join(' '),
      })

      setCanvasTemplate({
        ...template,
        jsonSpec: generatedSlideJson,
      })
      setTemplateStatusMessage(
        `Generated ${template.name} from ${
          attachments.length === 0
            ? 'the selected template.'
            : `${attachments.length} context file${attachments.length === 1 ? '' : 's'}.`
        }`,
      )
      navigate(DIAGRAM_CANVAS_ROUTE)
    } catch (submissionError) {
      setTemplateError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Failed to generate the slide diagram JSON.',
      )
    } finally {
      setIsTemplateSubmitting(false)
    }
  }

  return (
    <Routes>
      <Route
        path={EXPORTER_ROUTE}
        element={
          <PromptPage
            acceptAttr={ACCEPT_ATTR}
            isUploadOnlySelecting={isModelSelecting}
            onOpenDiagramPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
            onUploadOnlyFileChange={handleUploadOnlyFileChange}
            onUploadOnlySubmit={handleUploadOnlySubmit}
            selectedArchitectureDiagramId={modelSelection?.selectedDiagramId ?? ''}
            uploadOnlyFileCount={uploadOnlyAttachments.length}
            uploadOnlyError={modelSelectorError || error}
          />
        }
      />
      <Route
        path={DIAGRAM_PICKER_ROUTE}
        element={
          <DiagramPicker
            acceptAttr={ACCEPT_ATTR}
            attachmentCountLabel={attachmentCountLabel}
            attachments={attachments}
            error={templateError}
            isSubmitting={isTemplateSubmitting}
            onFileChange={handleFiles}
            onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
            onRemoveAttachment={removeAttachment}
            onSelectTemplate={handleSubmitTemplate}
            renderFileSize={formatFileSize}
          />
        }
      />
      <Route
        path={DIAGRAM_CANVAS_ROUTE}
        element={
          <TemplateCanvasPage
            template={canvasTemplate}
            statusMessage={templateStatusMessage}
            showJsonByDefault={isTemplateJsonOpenOnLoad}
            onOpenPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
            onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
          />
        }
      />
    </Routes>
  )
}

type TemplateCanvasPageProps = {
  onOpenPicker: () => void
  onOpenInputPage: () => void
  showJsonByDefault: boolean
  statusMessage: string
  template: DiagramTemplate
}

function TemplateCanvasPage({
  onOpenPicker,
  onOpenInputPage,
  showJsonByDefault,
  statusMessage,
  template,
}: TemplateCanvasPageProps) {
  const [isJsonPanelOpen, setIsJsonPanelOpen] = useState(showJsonByDefault)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const currentTemplateJson = useMemo(
    () => JSON.stringify(template.jsonSpec, null, 2),
    [template.jsonSpec],
  )

  useEffect(() => {
    setIsJsonPanelOpen(showJsonByDefault)
  }, [showJsonByDefault, template.id])

  async function handleExportPowerPoint() {
    setExportError('')
    setIsExporting(true)

    try {
      await generatePowerPointFromJson(template.jsonSpec)
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'Failed to export the current template JSON to PowerPoint.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3ff] px-6 py-5 text-[#17164d]">
      <div className="mx-auto flex h-[calc(100vh-40px)] max-w-[1440px] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.16em] text-[#7f1be8]">
              Template Canvas
            </p>
            <h1 className="mt-2 text-[clamp(1.9rem,3vw,2.8rem)] font-bold leading-none">
              {template.name}
            </h1>
            <p className="mt-2 max-w-3xl font-sans text-[1rem] leading-6 text-[#4e4c6b]">
              {statusMessage || 'Template JSON is rendered in React Flow.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportPowerPoint}
              disabled={isExporting}
              className="cursor-pointer rounded-none border border-[#17164d] bg-[#f3c316] px-5 py-2 text-[0.94rem] font-bold tracking-[0.12em] text-[#17164d] uppercase transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isExporting ? 'Exporting' : 'Export PPTX'}
            </button>
            <button
              type="button"
              onClick={onOpenPicker}
              className="cursor-pointer rounded-none border border-[#17164d] bg-transparent px-5 py-2 text-[0.94rem] font-bold tracking-[0.12em] uppercase transition hover:bg-[#17164d] hover:text-white"
            >
              Back to Picker
            </button>
            <button
              type="button"
              onClick={onOpenInputPage}
              className="cursor-pointer rounded-none border border-[#17164d] bg-[#17164d] px-5 py-2 text-[0.94rem] font-bold tracking-[0.12em] text-white uppercase transition hover:brightness-110"
            >
              Input Page
            </button>
          </div>
        </div>

        {exportError && (
          <p className="mt-3 max-w-4xl font-sans text-[0.92rem] leading-5 text-red-700">
            {exportError}
          </p>
        )}

        <div className="relative mt-5 min-h-0 flex-1 overflow-hidden border border-[#d8d4e9] bg-white">
          <SlideFlowCanvas input={template.jsonSpec} className="h-full" />

          <button
            type="button"
            onClick={() => setIsJsonPanelOpen((isOpen) => !isOpen)}
            aria-controls="template-json-panel"
            aria-expanded={isJsonPanelOpen}
            className={[
              'absolute bottom-[7.25rem] z-30 cursor-pointer border border-[#17164d] bg-white px-4 py-2 text-[0.78rem] font-bold tracking-[0.12em] text-[#17164d] uppercase shadow-[0_10px_24px_rgba(23,22,77,0.18)] transition hover:bg-[#17164d] hover:text-white',
              isJsonPanelOpen ? 'right-[27.5rem]' : 'right-4',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            JSON
          </button>

          <aside
            id="template-json-panel"
            className={[
              'absolute inset-y-0 right-0 z-20 flex w-full max-w-[26rem] flex-col border-l border-[#d8d4e9] bg-[#0e1234] text-white shadow-[-18px_0_45px_rgba(23,22,77,0.18)] transition-transform duration-200 ease-out',
              isJsonPanelOpen ? 'translate-x-0' : 'translate-x-full',
            ].join(' ')}
            aria-hidden={!isJsonPanelOpen}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/12 px-5 py-4">
              <div>
                <p className="text-[0.72rem] font-bold tracking-[0.16em] text-[#f3c316] uppercase">
                  Current JSON
                </p>
                <h2 className="mt-1 text-xl font-bold">{template.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsJsonPanelOpen(false)}
                className="cursor-pointer border border-white/30 bg-transparent px-3 py-1.5 text-[0.72rem] font-bold tracking-[0.12em] text-white uppercase transition hover:bg-white hover:text-[#0e1234]"
              >
                Close
              </button>
            </div>

            <pre className="min-h-0 flex-1 overflow-auto p-5 font-mono text-[0.78rem] leading-5 whitespace-pre text-[#d9e4ff]">
              {currentTemplateJson}
            </pre>
          </aside>
        </div>
      </div>
    </main>
  )
}
