import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { getDefaultDiagramTemplate, type DiagramTemplate } from './lib/diagramTemplates'
import {
  getSelectedArchitectureTemplate,
  selectArchitectureDiagramModel,
} from './lib/modelSelector'
import { generateSlidePromptOutput } from './lib/OpenAI'
import { ACCEPT_ATTR, useDiagramSession } from './hooks/useDiagramSession'
import { JsonInputPage } from './pages/JsonInputPage'
import { LoginPage } from './pages/LoginPage'
import { PromptPage } from './pages/PromptPage'
import { SlidePickerPage } from './pages/SlidePickerPage'
import { TemplateCanvasPage } from './pages/TemplateCanvasPage'
import type { ModelSelectorOutput } from './types/ModelSelectorOutput'
import { formatFileSize } from './utils/files'

const EXPORTER_ROUTE = '/'
const DIAGRAM_PICKER_ROUTE = '/diagram-picker'
const DIAGRAM_CANVAS_ROUTE = '/diagram-template'
const JSON_INPUT_ROUTE = '/json-input'
const LOGIN_ROUTE = '/login'
const EMAIL_SESSION_STORAGE_KEY = 'tts-mermaid-email'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [session, setSession] = useState(() => getStoredSession())
  const [canvasTemplate, setCanvasTemplate] = useState<DiagramTemplate>(() => getDefaultDiagramTemplate())
  const [templateStatusMessage, setTemplateStatusMessage] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(false)
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
      if (isCreateMode) {
        const { generateArchitectureDiagramFromExamples } = await import('./lib/diagramGenerator')
        const createdDiagramJson = await generateArchitectureDiagramFromExamples({
          uploadedFiles: uploadOnlyAttachments,
        })

        setModelSelection(null)
        setCanvasTemplate({
          id: 'created-architecture-diagram',
          name: createdDiagramJson.presentation.title || 'Created Architecture Diagram',
          description: 'A generated architecture diagram created from uploaded source material.',
          image: '',
          relatedAlt: 'Created architecture diagram',
          jsonSpec: createdDiagramJson,
        })
        setTemplateStatusMessage(
          `Created a new architecture diagram from ${uploadOnlyAttachments.length} uploaded file${
            uploadOnlyAttachments.length === 1 ? '' : 's'
          }.`,
        )
        setIsTemplateJsonOpenOnLoad(true)
        navigate(DIAGRAM_CANVAS_ROUTE)
        return
      }

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
          : isCreateMode
            ? 'Failed to create an architecture diagram.'
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
                    createMode={isCreateMode}
                    isUploadOnlySelecting={isModelSelecting}
                    onCreateModeChange={setIsCreateMode}
                    onOpenDiagramPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
                    onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
                    onOpenJsonInput={() => navigate(JSON_INPUT_ROUTE)}
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
                  <SlidePickerPage
                    acceptAttr={ACCEPT_ATTR}
                    attachmentCountLabel={attachmentCountLabel}
                    attachments={attachments}
                    error={templateError}
                    isSubmitting={isTemplateSubmitting}
                    onFileChange={handleFiles}
                    onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
                    onOpenJsonInput={() => navigate(JSON_INPUT_ROUTE)}
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
              path={JSON_INPUT_ROUTE}
              element={
                session ? (
                  <JsonInputPage
                    onOpenDiagramPicker={() => navigate(DIAGRAM_PICKER_ROUTE)}
                    onOpenInputPage={() => navigate(EXPORTER_ROUTE)}
                    onOpenJsonInput={() => navigate(JSON_INPUT_ROUTE)}
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
