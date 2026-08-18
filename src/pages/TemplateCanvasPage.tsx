import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import type { DiagramTemplate } from '../lib/diagramTemplates'
import { addBrandedSlideFrame } from '../lib/export/PowerpointBranding'
import { generatePowerPointFromJson, type PowerPointFileHandle } from '../lib/export/exporter'
import { buildSlideCanvasModel } from '../lib/slide-canvas/model'
import { SvgSlideCanvas } from '../lib/slide-svg/SvgSlideCanvas'

const LazySlideFlowCanvas = lazy(() =>
  import('../lib/slide-flow/SlideFlowCanvas').then((module) => ({
    default: module.SlideFlowCanvas,
  })),
)

const POWERPOINT_ACCEPT_ATTR =
  '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'
const ADD_NODE_COLORS = [
  { label: 'Navy', value: '070154' },
  { label: 'Light Gray', value: 'E8EEF8' },
  { label: 'Blue', value: '00A3FF' },
  { label: 'Gold', value: 'FFC700' },
  { label: 'Green', value: '1DD566' },
  { label: 'Magenta', value: 'F900D3' },
]

type AddNodeShape = 'database' | 'elbowLine' | 'rectangle' | 'square' | 'straightLine'

type TemplateCanvasPageProps = {
  onOpenInputPage: () => void
  onOpenPicker: () => void
  onTemplateJsonChange: (jsonSpec: unknown) => void
  showJsonByDefault: boolean
  statusMessage: string
  template: DiagramTemplate
  templateKind: 'commentary' | 'diagram'
}

export function TemplateCanvasPage({
  onOpenInputPage,
  onOpenPicker,
  onTemplateJsonChange,
  showJsonByDefault,
  statusMessage,
  template,
  templateKind,
}: TemplateCanvasPageProps) {
  const [isJsonPanelOpen, setIsJsonPanelOpen] = useState(showJsonByDefault)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const [selectedPowerPointFile, setSelectedPowerPointFile] = useState<File | null>(null)
  const [selectedPowerPointHandle, setSelectedPowerPointHandle] = useState<PowerPointFileHandle | null>(null)
  const [insertAfterSlide, setInsertAfterSlide] = useState('1')
  const [createNewEditedCopy, setCreateNewEditedCopy] = useState(true)
  const [isAddNodeMenuOpen, setIsAddNodeMenuOpen] = useState(false)
  const [addNodeColor, setAddNodeColor] = useState(ADD_NODE_COLORS[0].value)
  const powerpointFileInputRef = useRef<HTMLInputElement>(null)
  const currentTemplateJson = useMemo(
    () => JSON.stringify(template.jsonSpec, null, 2),
    [template.jsonSpec],
  )
  const canvasSlide = useMemo(
    () => buildSlideCanvasModel(template.jsonSpec, { resolveAssets: false }).slide,
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
      await generatePowerPointFromJson(addBrandedSlideFrame(template.jsonSpec), {
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
      await generatePowerPointFromJson(addBrandedSlideFrame(template.jsonSpec))
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

  function handleAddCanvasNode(shape: AddNodeShape) {
    const updatedTemplateJson = addCanvasNodeToTemplateJson(template.jsonSpec, {
      color: addNodeColor,
      shape,
      slideHeight: canvasSlide?.height,
      slideWidth: canvasSlide?.width,
    })

    onTemplateJsonChange(updatedTemplateJson)
    setIsAddNodeMenuOpen(false)
    setIsJsonPanelOpen(false)
  }

  function handleClearCanvasLines() {
    onTemplateJsonChange(removeLineElementsFromTemplateJson(template.jsonSpec))
    setIsAddNodeMenuOpen(false)
    setIsJsonPanelOpen(false)
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
              {statusMessage || 'Template JSON is rendered on the editable slide canvas.'}
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
              Export
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
          {templateKind === 'commentary' ? (
            <SvgSlideCanvas
              input={template.jsonSpec}
              onChange={onTemplateJsonChange}
              className="h-full"
            />
          ) : (
            <Suspense fallback={<CanvasLoadingState />}>
              <LazySlideFlowCanvas
                input={template.jsonSpec}
                onChange={onTemplateJsonChange}
                className="h-full"
              />
            </Suspense>
          )}

          <div
            className={[
              'absolute bottom-[10.5rem] z-40',
              isJsonPanelOpen ? 'right-[27.5rem]' : 'right-4',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => setIsAddNodeMenuOpen((isOpen) => !isOpen)}
              aria-controls="add-canvas-node-menu"
              aria-expanded={isAddNodeMenuOpen}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-[#f3c316] bg-[#f3c316] text-2xl font-bold leading-none text-[#070a1b] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:brightness-105"
              title="Add node"
            >
              +
            </button>

            {isAddNodeMenuOpen && (
              <div
                id="add-canvas-node-menu"
                className="absolute right-0 bottom-14 w-[18rem] rounded-[1rem] border border-white/12 bg-[#0b0f24] p-4 text-[#eef3ff] shadow-[0_18px_45px_rgba(0,0,0,0.34)]"
                role="dialog"
                aria-label="Add node to canvas"
              >
                <div className="mb-3">
                  <p className="text-[0.68rem] font-bold tracking-[0.16em] text-[#f3c316] uppercase">
                    Add Shape
                  </p>
                  <p className="mt-1 text-[0.78rem] leading-5 text-[#a8afc4]">
                    Choose a shape and background color.
                  </p>
                </div>

                <div className="mb-4 flex flex-wrap gap-2" aria-label="Node color">
                  {ADD_NODE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setAddNodeColor(color.value)}
                      className={[
                        'h-7 w-7 cursor-pointer rounded-full border transition',
                        addNodeColor === color.value
                          ? 'border-[#f3c316] ring-2 ring-[#f3c316]/45'
                          : 'border-white/20 hover:border-white/55',
                      ].join(' ')}
                      style={{ backgroundColor: `#${color.value}` }}
                      title={color.label}
                      aria-label={color.label}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddCanvasNode('rectangle')}
                    className="cursor-pointer rounded-[0.8rem] border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
                  >
                    Rectangle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCanvasNode('square')}
                    className="cursor-pointer rounded-[0.8rem] border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
                  >
                    Square
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCanvasNode('straightLine')}
                    className="cursor-pointer rounded-[0.8rem] border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
                  >
                    Straight Arrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCanvasNode('database')}
                    className="cursor-pointer rounded-[0.8rem] border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
                  >
                    Database
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCanvasNode('elbowLine')}
                    className="cursor-pointer rounded-[0.8rem] border border-[#28304a] bg-[#080c1c] px-3 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
                  >
                    Angle Arrow
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCanvasLines}
                    className="cursor-pointer rounded-[0.8rem] border border-[#28304a] bg-transparent px-3 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
                  >
                    Clear Lines
                  </button>
                </div>
              </div>
            )}
          </div>

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

function CanvasLoadingState() {
  return (
    <div className="slide-canvas-empty h-full" role="status">
      Loading slide canvas…
    </div>
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

type AddCanvasNodeOptions = {
  color: string
  shape: AddNodeShape
  slideHeight?: number
  slideWidth?: number
}

type NativeSlideElement = Record<string, unknown>
type NativeSlideRecord = Record<string, unknown> & {
  elements?: unknown[]
}

function addCanvasNodeToTemplateJson(input: unknown, options: AddCanvasNodeOptions) {
  const nextInput = cloneTemplateJson(input)
  const targetSlide = getEditableSlideRecord(nextInput)

  if (!targetSlide) {
    return nextInput
  }

  const existingElements = Array.isArray(targetSlide.elements) ? targetSlide.elements : []
  targetSlide.elements = [
    ...existingElements,
    createCanvasNodeElement(options, existingElements.length),
  ]

  return nextInput
}

function removeLineElementsFromTemplateJson(input: unknown) {
  const nextInput = cloneTemplateJson(input)
  const targetSlide = getEditableSlideRecord(nextInput)

  if (!targetSlide || !Array.isArray(targetSlide.elements)) {
    return nextInput
  }

  targetSlide.elements = targetSlide.elements.filter((element) => !isLineElementRecord(element))
  return nextInput
}

function cloneTemplateJson(input: unknown) {
  if (typeof structuredClone === 'function') {
    return structuredClone(input)
  }

  return JSON.parse(JSON.stringify(input)) as unknown
}

function getEditableSlideRecord(input: unknown): NativeSlideRecord | undefined {
  if (Array.isArray(input)) {
    return input.find(hasElementsArray) ?? (input[0] && isRecordValue(input[0]) ? input[0] : undefined)
  }

  if (!isRecordValue(input)) {
    return undefined
  }

  if (hasElementsArray(input)) {
    return input
  }

  const presentation = isRecordValue(input.presentation) ? input.presentation : input
  if (Array.isArray(presentation.slides)) {
    return presentation.slides.find(hasElementsArray) ??
      (presentation.slides[0] && isRecordValue(presentation.slides[0]) ? presentation.slides[0] : undefined)
  }

  if (isRecordValue(presentation.slide)) {
    return presentation.slide
  }

  if (isRecordValue(input.slide)) {
    return input.slide
  }

  return undefined
}

function hasElementsArray(value: unknown): value is NativeSlideRecord {
  return isRecordValue(value) && Array.isArray(value.elements)
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createCanvasNodeElement(options: AddCanvasNodeOptions, elementIndex: number): NativeSlideElement {
  const slideWidth = options.slideWidth ?? 1280
  const slideHeight = options.slideHeight ?? 720
  const x = Math.max(40, Math.round(slideWidth * 0.58 + elementIndex * 12) % Math.max(slideWidth - 220, 220))
  const y = Math.max(40, Math.round(slideHeight * 0.26 + elementIndex * 10) % Math.max(slideHeight - 140, 140))
  const id = `canvas-node-${Date.now()}-${elementIndex + 1}`

  if (options.shape === 'straightLine' || options.shape === 'elbowLine') {
    const isElbowLine = options.shape === 'elbowLine'

    return {
      id,
      type: 'line',
      lineType: isElbowLine ? 'elbow' : 'straight',
      x1: x,
      y1: y + 38,
      x2: x + 150,
      y2: y + (isElbowLine ? 116 : 38),
      stroke: options.color,
      strokeWidth: 3,
      endArrow: 'triangle',
    }
  }

  const isSquare = options.shape === 'square'

  return {
    id,
    kind: 'shape',
    shape: options.shape === 'database' ? 'flowChartMagneticDisk' : 'rect',
    x,
    y,
    w: isSquare ? 96 : 172,
    h: isSquare ? 96 : 84,
    fill: options.color,
    stroke: options.color === '070154' ? '0047FF' : '070154',
    strokeWidth: 2,
    label: options.shape === 'database' ? 'Database' : 'New Node',
    color: getReadableTextColor(options.color),
    fontSize: 18,
    bold: true,
    align: 'center',
    valign: 'middle',
    padding: 8,
  }
}

function getReadableTextColor(backgroundColor: string) {
  return ['E8EEF8', 'FFC700', '1DD566', '00A3FF'].includes(backgroundColor) ? '070154' : 'FFFFFF'
}

function isLineElementRecord(value: unknown) {
  if (!isRecordValue(value)) {
    return false
  }

  return value.type === 'line' || value.kind === 'line'
}
