import { useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { DiagramCanvas } from './components/DiagramCanvas'
import { DiagramPicker } from './components/DiagramPicker'
import { PromptPage } from './components/PromptPage'
import { ACCEPT_ATTR } from './lib/diagram'
import { getDefaultDiagramTemplate, type DiagramTemplate } from './lib/diagramTemplates'
import { SlideFlowCanvas } from './lib/slide-flow'
import { useDiagramSession } from './hooks/useDiagramSession'
import { formatFileSize } from './utils/files'

const EXPORTER_ROUTE = '/'
const DIAGRAM_PICKER_ROUTE = '/diagram-picker'
const GENERATED_DIAGRAM_ROUTE = '/diagram'
const DIAGRAM_CANVAS_ROUTE = '/diagram-template'

export default function App() {
  const navigate = useNavigate()
  const [canvasTemplate, setCanvasTemplate] = useState<DiagramTemplate>(() => getDefaultDiagramTemplate())
  const [templateStatusMessage, setTemplateStatusMessage] = useState('')
  const {
    attachmentCountLabel,
    attachments,
    error,
    handleFiles,
    handleMessageChange,
    handleSubmit,
    isSubmitting,
    message,
    promptOutput,
    removeAttachment,
    submittedMessage,
    updateSubmittedMessage,
  } = useDiagramSession({
    onGenerated: () => navigate(GENERATED_DIAGRAM_ROUTE),
  })

  function handleSubmitTemplate(template: DiagramTemplate) {
    setCanvasTemplate(template)
    setTemplateStatusMessage(
      `Loaded ${template.name}. ${
        attachments.length > 0
          ? `${attachments.length} context file${attachments.length === 1 ? '' : 's'} still attached on the picker route.`
          : 'Template JSON is rendered in React Flow.'
      }`,
    )
    navigate(DIAGRAM_CANVAS_ROUTE)
  }

  return (
    <Routes>
      <Route
        path={EXPORTER_ROUTE}
        element={
          <PromptPage
            acceptAttr={ACCEPT_ATTR}
            attachmentCountLabel={attachmentCountLabel}
            attachments={attachments}
            error={error}
            isSubmitting={isSubmitting}
            message={message}
            onFileChange={handleFiles}
            onMessageChange={handleMessageChange}
            onOpenDiagramPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
            onRemoveAttachment={removeAttachment}
            onSubmit={handleSubmit}
            renderFileSize={formatFileSize}
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
            onFileChange={handleFiles}
            onOpenPromptPage={() => navigate(EXPORTER_ROUTE)}
            onRemoveAttachment={removeAttachment}
            onSelectTemplate={handleSubmitTemplate}
            renderFileSize={formatFileSize}
          />
        }
      />
      <Route
        path={GENERATED_DIAGRAM_ROUTE}
        element={
          submittedMessage && promptOutput ? (
            <ReactFlowProvider>
              <DiagramCanvas
                message={submittedMessage}
                onBack={() => navigate(EXPORTER_ROUTE)}
                onUpdateMessage={updateSubmittedMessage}
                promptOutput={promptOutput}
              />
            </ReactFlowProvider>
          ) : (
            <Navigate to={EXPORTER_ROUTE} replace />
          )
        }
      />
      <Route
        path={DIAGRAM_CANVAS_ROUTE}
        element={
          <TemplateCanvasPage
            template={canvasTemplate}
            statusMessage={templateStatusMessage}
            onOpenPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
            onOpenPromptPage={() => navigate(EXPORTER_ROUTE)}
          />
        }
      />
    </Routes>
  )
}

type TemplateCanvasPageProps = {
  onOpenPicker: () => void
  onOpenPromptPage: () => void
  statusMessage: string
  template: DiagramTemplate
}

function TemplateCanvasPage({
  onOpenPicker,
  onOpenPromptPage,
  statusMessage,
  template,
}: TemplateCanvasPageProps) {
  const [isJsonPanelOpen, setIsJsonPanelOpen] = useState(false)
  const currentTemplateJson = useMemo(
    () => JSON.stringify(template.jsonSpec, null, 2),
    [template.jsonSpec],
  )

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
              onClick={onOpenPicker}
              className="cursor-pointer rounded-none border border-[#17164d] bg-transparent px-5 py-2 text-[0.94rem] font-bold tracking-[0.12em] uppercase transition hover:bg-[#17164d] hover:text-white"
            >
              Back to Picker
            </button>
            <button
              type="button"
              onClick={onOpenPromptPage}
              className="cursor-pointer rounded-none border border-[#17164d] bg-[#17164d] px-5 py-2 text-[0.94rem] font-bold tracking-[0.12em] text-white uppercase transition hover:brightness-110"
            >
              Prompt Page
            </button>
          </div>
        </div>

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
