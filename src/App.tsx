import { ReactFlowProvider } from '@xyflow/react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import '@xyflow/react/dist/style.css'

import { DiagramCanvas } from './components/DiagramCanvas'
import { DiagramPicker } from './components/DiagramPicker'
import { PromptPage } from './components/PromptPage'
import { ACCEPT_ATTR } from './lib/diagram'
import { useDiagramSession } from './hooks/useDiagramSession'
import { formatFileSize } from './utils/files'

export default function App() {
  const navigate = useNavigate()
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
    onGenerated: () => navigate('/diagram'),
  })

  return (
    <Routes>
      <Route
        path="/"
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
            onOpenDiagramPicker={() => navigate('/diagram-picker')}
            onRemoveAttachment={removeAttachment}
            onSubmit={handleSubmit}
            renderFileSize={formatFileSize}
          />
        }
      />
      <Route
        path="/diagram-picker"
        element={
          <DiagramPicker
            acceptAttr={ACCEPT_ATTR}
            attachmentCountLabel={attachmentCountLabel}
            attachments={attachments}
            onFileChange={handleFiles}
            onOpenPromptPage={() => navigate('/')}
            onRemoveAttachment={removeAttachment}
            renderFileSize={formatFileSize}
          />
        }
      />
      <Route
        path="/diagram"
        element={
          submittedMessage && promptOutput ? (
            <ReactFlowProvider>
              <DiagramCanvas
                message={submittedMessage}
                onBack={() => navigate('/')}
                onUpdateMessage={updateSubmittedMessage}
                promptOutput={promptOutput}
              />
            </ReactFlowProvider>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  )
}
