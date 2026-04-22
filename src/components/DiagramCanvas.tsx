import { useState } from 'react'
import type { ReactNode } from 'react'
import { Background, ConnectionLineType, Controls, MiniMap, ReactFlow } from '@xyflow/react'

import { JsonEditorPanel } from './JsonEditorPanel'
import { MetadataPanel } from './MetadataPanel'
import { DEFAULT_EDGE_OPTIONS } from '../constants/diagram'
import { useDiagramFlow } from '../hooks/useDiagramFlow'
import type { PromptOutput } from '../types/PromptOutput'

type DiagramCanvasProps = {
  message: string
  onBack: () => void
  onUpdateMessage: (value: string) => void
  promptOutput: PromptOutput
}

type PanelMode = 'prompt' | 'metadata' | null

type DockButtonProps = {
  active?: boolean
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
}

function DockButton({ active = false, children, disabled, label, onClick }: DockButtonProps) {
  return (
    <button
      type="button"
      className={[
        'grid h-[3.25rem] w-[3.25rem] cursor-pointer place-items-center rounded-full border border-[#171717]/8 bg-gradient-to-br from-[#f26f21] to-[#c95518] p-0 text-white shadow-[0_14px_28px_rgba(242,111,33,0.28)] transition duration-150 ease-out hover:-translate-y-px disabled:cursor-not-allowed disabled:border-[#171717]/6 disabled:from-[#bdbdbd] disabled:to-[#8f8f8f] disabled:shadow-none disabled:transform-none',
        active && 'ring-2 ring-[#171717]/12 ring-offset-2 ring-offset-white',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <span className="inline-flex h-[1.35rem] w-[1.35rem]" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}

export function DiagramCanvas({
  message,
  onBack,
  onUpdateMessage,
  promptOutput,
}: DiagramCanvasProps) {
  const [activePanel, setActivePanel] = useState<PanelMode>(null)
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectedNodes } = useDiagramFlow({
    promptOutput,
  })

  const closePanel = () => setActivePanel(null)
  const openMetadataPanel = () => setActivePanel('metadata')
  const openPromptPanel = () => setActivePanel('prompt')
  const isPanelVisible = activePanel !== null

  return (
    <main className="h-screen min-h-screen overflow-hidden p-0">
      <div
        className={[
          'grid min-h-screen h-screen grid-cols-1',
          isPanelVisible ? 'min-[881px]:grid-cols-[minmax(0,1fr)_380px]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <section className="min-h-0 h-full overflow-hidden [&_.react-flow]:bg-[radial-gradient(circle_at_top_left,rgba(242,111,33,0.12),transparent_20%),linear-gradient(180deg,#ffffff_0%,#f6f6f6_100%)] [&_.react-flow__node.selected]:shadow-[0_0_0_3px_rgba(242,111,33,0.26)] [&_.react-flow__controls-button]:border-[#171717]/10 [&_.react-flow__controls-button]:bg-white/96 [&_.react-flow__controls-button]:text-[#171717] [&_.react-flow__minimap]:rounded-2xl [&_.react-flow__minimap]:border [&_.react-flow__minimap]:border-[#171717]/10 [&_.react-flow__minimap]:bg-white/92">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            connectionLineType={ConnectionLineType.Step}
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap pannable zoomable />
            <Controls />
            <Background gap={24} size={1} color="#d7d7d7" />
          </ReactFlow>
        </section>

        {activePanel === 'prompt' && (
          <JsonEditorPanel
            value={message}
            onClose={closePanel}
            onSave={onUpdateMessage}
          />
        )}

        {activePanel === 'metadata' && (
          <MetadataPanel nodes={selectedNodes} onClose={closePanel} />
        )}
      </div>

      <nav
        className="fixed bottom-[1.1rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#171717]/10 bg-white/92 p-3 shadow-[0_24px_80px_rgba(23,23,23,0.14)] backdrop-blur-xl max-[640px]:bottom-[0.85rem]"
        aria-label="Canvas controls"
      >
        <DockButton label="Back to prompt" onClick={onBack}>
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            className="h-full w-full fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
          >
            <path d="M14 6 8 12l6 6" />
            <path d="M9 12h7" />
          </svg>
        </DockButton>

        <DockButton
          label="Open submitted prompt"
          onClick={openPromptPanel}
          active={activePanel === 'prompt'}
        >
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            className="h-full w-full fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
          >
            <path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 7 20V5a1.5 1.5 0 0 1 1-1.5Z" />
            <path d="M14 3.5V8h4" />
            <path d="M10 12h4" />
            <path d="M10 16h4" />
          </svg>
        </DockButton>

        <DockButton
          label="Open selected node metadata"
          onClick={openMetadataPanel}
          disabled={selectedNodes.length === 0}
          active={activePanel === 'metadata'}
        >
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            className="h-full w-full fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M12 10v5" />
            <path d="M12 7.5h.01" />
          </svg>
        </DockButton>
      </nav>
    </main>
  )
}
