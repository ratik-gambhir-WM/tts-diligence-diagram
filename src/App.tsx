import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { DiagramPicker } from './components/DiagramPicker'
import { LoginPage } from './components/LoginPage'
import { PromptPage } from './components/PromptPage'
import { ACCEPT_ATTR } from './lib/diagram'
import { getDefaultDiagramTemplate, type DiagramTemplate } from './lib/diagramTemplates'
import { generatePowerPointFromJson, type PowerPointFileHandle } from './lib/export/exporter'
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
const LOGIN_ROUTE = '/login'
const EMAIL_SESSION_STORAGE_KEY = 'tts-mermaid-email'
const POWERPOINT_ACCEPT_ATTR =
  '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [session, setSession] = useState(() => getStoredSession())
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

  function handleLogin(credentials: { email: string }) {
    storeSession(credentials)
    setSession(credentials)
    navigate(EXPORTER_ROUTE)
  }

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
    <div className="min-h-screen overflow-x-hidden bg-[#070a1b]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={location.pathname}
          className="min-h-screen bg-[#070a1b] will-change-transform"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 140 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -140 }}
          transition={{ duration: shouldReduceMotion ? 0.12 : 0.46, ease: [0.22, 1, 0.36, 1] }}
        >
          <Routes location={location}>
          <Route
            path={LOGIN_ROUTE}
            element={
              session ? (
                <Navigate replace to={EXPORTER_ROUTE} />
              ) : (
                <LoginPage
                  initialEmailLocalPart={getEmailLocalPart(getStoredEmail())}
                  onSubmit={handleLogin}
                />
              )
            }
          />
          <Route
            path={EXPORTER_ROUTE}
            element={
              session ? (
                <PromptPage
                  acceptAttr={ACCEPT_ATTR}
                  isUploadOnlySelecting={isModelSelecting}
                  onOpenDiagramPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
                  onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
                  onUploadOnlyFileChange={handleUploadOnlyFileChange}
                  onUploadOnlySubmit={handleUploadOnlySubmit}
                  selectedArchitectureDiagramId={modelSelection?.selectedDiagramId ?? ''}
                  uploadOnlyFiles={uploadOnlyAttachments.map((file) => ({
                    name: file.name,
                    size: file.size,
                  }))}
                  uploadOnlyFileCount={uploadOnlyAttachments.length}
                  uploadOnlyError={modelSelectorError || error}
                />
              ) : (
                <Navigate replace to={LOGIN_ROUTE} />
              )
            }
          />
          <Route
            path={DIAGRAM_PICKER_ROUTE}
            element={
              session ? (
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
              ) : (
                <Navigate replace to={LOGIN_ROUTE} />
              )
            }
          />
          <Route
            path={DIAGRAM_CANVAS_ROUTE}
            element={
              session ? (
                <TemplateCanvasPage
                  template={canvasTemplate}
                  statusMessage={templateStatusMessage}
                  showJsonByDefault={isTemplateJsonOpenOnLoad}
                  onTemplateJsonChange={(jsonSpec) =>
                    setCanvasTemplate((currentTemplate) => ({
                      ...currentTemplate,
                      jsonSpec,
                    }))
                  }
                  onOpenPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
                  onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
                />
              ) : (
                <Navigate replace to={LOGIN_ROUTE} />
              )
            }
          />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function getStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  const email = window.sessionStorage.getItem(EMAIL_SESSION_STORAGE_KEY)

  if (!email) {
    return null
  }

  return { email }
}

function storeSession(credentials: { email: string }) {
  window.sessionStorage.setItem(EMAIL_SESSION_STORAGE_KEY, credentials.email)
}

function getStoredEmail() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.sessionStorage.getItem(EMAIL_SESSION_STORAGE_KEY) ?? ''
}

function getEmailLocalPart(email: string) {
  return email.replace(/@westmonroe\.com$/i, '')
}

type TemplateCanvasPageProps = {
  onOpenInputPage: () => void
  onOpenPicker: () => void
  onTemplateJsonChange: (jsonSpec: unknown) => void
  showJsonByDefault: boolean
  statusMessage: string
  template: DiagramTemplate
}

function TemplateCanvasPage({
  onOpenInputPage,
  onOpenPicker,
  onTemplateJsonChange,
  showJsonByDefault,
  statusMessage,
  template,
}: TemplateCanvasPageProps) {
  const [isJsonPanelOpen, setIsJsonPanelOpen] = useState(showJsonByDefault)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const [selectedPowerPointFile, setSelectedPowerPointFile] = useState<File | null>(null)
  const [selectedPowerPointHandle, setSelectedPowerPointHandle] = useState<PowerPointFileHandle | null>(null)
  const [insertAfterSlide, setInsertAfterSlide] = useState('1')
  const [createNewEditedCopy, setCreateNewEditedCopy] = useState(true)
  const powerpointFileInputRef = useRef<HTMLInputElement>(null)
  const currentTemplateJson = useMemo(
    () => JSON.stringify(template.jsonSpec, null, 2),
    [template.jsonSpec],
  )

  useEffect(() => {
    setIsJsonPanelOpen(showJsonByDefault)
  }, [showJsonByDefault, template.id])

  async function handleChoosePowerPointFile() {
    setExportError('')
    setExportStatus('')

    const fileHandle = await chooseWritablePowerPointFile()
    if (fileHandle) {
      const file = await fileHandle.getFile()
      setSelectedPowerPointFile(file)
      setSelectedPowerPointHandle(fileHandle)
      return
    }

    powerpointFileInputRef.current?.click()
  }

  function handlePowerPointFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]

    if (!file) {
      return
    }

    if (!isPowerPointFile(file)) {
      setSelectedPowerPointFile(null)
      setSelectedPowerPointHandle(null)
      setExportError('Choose a .pptx PowerPoint file.')
      event.currentTarget.value = ''
      return
    }

    setSelectedPowerPointFile(file)
    setSelectedPowerPointHandle(null)
    setExportError('')
    setExportStatus('')
  }

  async function handleAddSlideToPowerPoint() {
    setExportError('')
    setExportStatus('')

    if (!selectedPowerPointFile) {
      await handleChoosePowerPointFile()
      return
    }

    const parsedInsertAfterSlide = Number(insertAfterSlide)
    if (!Number.isInteger(parsedInsertAfterSlide) || parsedInsertAfterSlide < 0) {
      setExportError('Enter a whole slide number. Use 0 to insert before the first slide.')
      return
    }

    if (!createNewEditedCopy && !selectedPowerPointHandle) {
      setExportError('Direct editing requires the browser file picker with write access. Select the .pptx again or create a new copy.')
      return
    }

    setIsExporting(true)

    try {
      await generatePowerPointFromJson(template.jsonSpec, {
        targetFile: selectedPowerPointFile,
        targetFileHandle: selectedPowerPointHandle ?? undefined,
        insertAfterSlide: parsedInsertAfterSlide,
        writeMode: createNewEditedCopy ? 'copy' : 'overwrite',
      })
      setExportStatus(
        createNewEditedCopy
          ? 'Created a new PowerPoint copy with the slide added.'
          : `Updated ${selectedPowerPointFile.name}. Open the file from Finder to view the edited presentation.`,
      )
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'Failed to add the current slide to the selected PowerPoint file.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleCreateNewPowerPoint() {
    setExportError('')
    setExportStatus('')
    setIsExporting(true)

    try {
      await generatePowerPointFromJson(template.jsonSpec)
      setExportStatus('Created a new PowerPoint deck.')
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
    <main className="min-h-screen bg-[#070a1b] px-6 py-5 text-[#eef3ff]">
      <div className="mx-auto flex h-[calc(100vh-40px)] max-w-[1440px] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.16em] text-[#f3c316]">
              Template Canvas
            </p>
            <h1 className="mt-2 text-[clamp(1.9rem,3vw,2.8rem)] font-bold leading-none text-white">
              {template.name}
            </h1>
            <p className="mt-2 max-w-3xl text-[0.95rem] leading-6 text-[#a8afc4]">
              {statusMessage || 'Template JSON is rendered in React Flow.'}
            </p>
          </div>

          <div className="flex max-w-[48rem] flex-wrap items-end justify-end gap-3">
            <input
              ref={powerpointFileInputRef}
              type="file"
              accept={POWERPOINT_ACCEPT_ATTR}
              onChange={handlePowerPointFileChange}
              className="hidden"
            />
            <label className="grid gap-1">
              <span className="text-[0.68rem] font-bold tracking-[0.14em] text-[#8d93aa] uppercase">
                After slide
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={insertAfterSlide}
                onChange={(event) => setInsertAfterSlide(event.currentTarget.value)}
                className="w-24 border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.86rem] font-bold text-[#eef3ff] outline-none focus:border-[#f3c316]"
                aria-label="Slide number to insert after"
              />
            </label>
            <button
              type="button"
              onClick={handleAddSlideToPowerPoint}
              disabled={isExporting}
              className="cursor-pointer border border-[#f3c316] bg-[#f3c316] px-5 py-2 text-[0.9rem] font-bold tracking-[0.12em] text-[#070a1b] uppercase transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isExporting
                ? 'Exporting'
                : selectedPowerPointFile
                  ? 'Add Slide'
                  : 'Choose PPTX'}
            </button>
            <button
              type="button"
              onClick={handleChoosePowerPointFile}
              disabled={isExporting}
              className="max-w-[14rem] cursor-pointer truncate border border-[#28304a] bg-[#080c1c] px-4 py-2 text-[0.78rem] font-bold tracking-[0.08em] text-[#eef3ff] uppercase transition hover:border-[#f3c316] hover:text-[#f3c316] disabled:cursor-not-allowed disabled:opacity-70"
              title={selectedPowerPointFile?.name || 'Choose an existing .pptx file'}
            >
              {selectedPowerPointFile ? selectedPowerPointFile.name : 'Select PPTX'}
            </button>
            <label className="flex max-w-[15rem] cursor-pointer items-center gap-2 border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.72rem] font-bold tracking-[0.08em] text-[#eef3ff] uppercase">
              <input
                type="checkbox"
                checked={createNewEditedCopy}
                onChange={(event) => setCreateNewEditedCopy(event.currentTarget.checked)}
                className="h-4 w-4 accent-[#f3c316]"
              />
              Create new copy
            </label>
            <button
              type="button"
              onClick={handleCreateNewPowerPoint}
              disabled={isExporting}
              className="cursor-pointer border border-[#28304a] bg-transparent px-4 py-2 text-[0.78rem] font-bold tracking-[0.12em] text-[#eef3ff] uppercase transition hover:border-[#f3c316] hover:text-[#f3c316] disabled:cursor-not-allowed disabled:opacity-70"
            >
              Create New
            </button>
            <button
              type="button"
              onClick={onOpenPicker}
              className="cursor-pointer border border-[#28304a] bg-transparent px-5 py-2 text-[0.9rem] font-bold tracking-[0.12em] text-[#eef3ff] uppercase transition hover:border-[#f3c316] hover:text-[#f3c316]"
            >
              Back to Picker
            </button>
            <button
              type="button"
              onClick={onOpenInputPage}
              className="cursor-pointer border border-[#28304a] bg-[#080c1c] px-5 py-2 text-[0.9rem] font-bold tracking-[0.12em] text-[#eef3ff] uppercase transition hover:border-[#f3c316] hover:text-[#f3c316]"
            >
              Input Page
            </button>
          </div>
        </div>

        {exportError && (
          <p className="mt-3 max-w-4xl text-[0.92rem] leading-5 text-[#ffb5b5]">
            {exportError}
          </p>
        )}
        {exportStatus && !exportError && (
          <p className="mt-3 max-w-4xl text-[0.92rem] leading-5 text-[#a8afc4]">
            {exportStatus}
          </p>
        )}

        <div className="relative mt-5 min-h-0 flex-1 overflow-hidden border border-white/12 bg-[#0b0f24]">
          <SlideFlowCanvas
            input={template.jsonSpec}
            onChange={onTemplateJsonChange}
            className="h-full"
          />

          <button
            type="button"
            onClick={() => setIsJsonPanelOpen((isOpen) => !isOpen)}
            aria-controls="template-json-panel"
            aria-expanded={isJsonPanelOpen}
            className={[
              'absolute bottom-[7.25rem] z-30 cursor-pointer border border-[#f3c316] bg-[#f3c316] px-4 py-2 text-[0.78rem] font-bold tracking-[0.12em] text-[#070a1b] uppercase shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:brightness-105',
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
              'absolute inset-y-0 right-0 z-20 flex w-full max-w-[26rem] flex-col border-l border-white/12 bg-[#0b0f24] text-white shadow-[-18px_0_45px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out',
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
                className="cursor-pointer border border-[#28304a] bg-transparent px-3 py-1.5 text-[0.72rem] font-bold tracking-[0.12em] text-white uppercase transition hover:border-[#f3c316] hover:text-[#f3c316]"
              >
                Close
              </button>
            </div>

            <pre className="min-h-0 flex-1 overflow-auto border-t border-white/8 bg-[#080c1c] p-5 font-mono text-[0.78rem] leading-5 whitespace-pre text-[#d9e4ff]">
              {currentTemplateJson}
            </pre>
          </aside>
        </div>
      </div>
    </main>
  )
}

interface PowerPointPickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean
    multiple?: boolean
    types?: Array<{
      accept: Record<string, string[]>
      description: string
    }>
  }) => Promise<PowerPointFileHandle[]>
}

async function chooseWritablePowerPointFile() {
  const browser = window as PowerPointPickerWindow

  if (!browser.showOpenFilePicker) {
    return undefined
  }

  try {
    const [fileHandle] = await browser.showOpenFilePicker({
      excludeAcceptAllOption: true,
      multiple: false,
      types: [
        {
          description: 'PowerPoint presentations',
          accept: {
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
          },
        },
      ],
    })

    if (!fileHandle) {
      return undefined
    }

    const file = await fileHandle.getFile()
    return isPowerPointFile(file) ? fileHandle : undefined
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return undefined
    }

    throw error
  }
}

function isPowerPointFile(file: File) {
  return (
    file.name.toLowerCase().endsWith('.pptx') &&
    (!file.type ||
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  )
}
