import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  applyElementEdit,
  buildSlideCanvasModel,
} from '../slide-canvas'
import { SvgSelection } from './SvgSelection'
import { SvgSlide } from './SvgSlide'
import { SvgSlideViewport } from './SvgSlideViewport'
import { SvgTextEditorOverlay } from './SvgTextEditorOverlay'
import {
  getConsistentSvgTextFontScales,
  getSvgTextScaleTemplateKey,
} from './svgTextLayout'
import { SUPPORTED_SHAPE_NAMES } from './shapes'
import { sanitizeSvgId, toSvgColor } from './svgUtils'
import { useSvgInteraction } from './useSvgInteraction'
import './svg-slide.css'

export interface SvgSlideCanvasProps {
  className?: string
  input: unknown
  onChange?: (input: unknown) => void
  slideIndex?: number
}

export function SvgSlideCanvas({
  className,
  input,
  onChange,
  slideIndex = 0,
}: SvgSlideCanvasProps) {
  const model = useMemo(
    () => buildSlideCanvasModel(input, { slideIndex }),
    [input, slideIndex],
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const reactId = useId()
  const canvasId = useMemo(() => `svg-slide-${sanitizeSvgId(reactId)}`, [reactId])
  const viewportSize = useFittedViewportSize(containerRef, model.slide?.width, model.slide?.height)
  const interaction = useSvgInteraction({
    elementRefs: model.elementRefs,
    input,
    onChange,
    svgRef,
  })
  const renderedRefs = useMemo(
    () =>
      interaction.state.draftEdit && interaction.state.selectedKey
        ? model.elementRefs.map((elementRef) =>
            elementRef.key === interaction.state.selectedKey
              ? {
                  ...elementRef,
                  element: applyElementEdit(elementRef.element, interaction.state.draftEdit ?? {}),
                }
              : elementRef,
          )
        : model.elementRefs,
    [interaction.state.draftEdit, interaction.state.selectedKey, model.elementRefs],
  )
  const renderedRefsByKey = useMemo(
    () => new Map(renderedRefs.map((elementRef) => [elementRef.key, elementRef])),
    [renderedRefs],
  )
  const textFontScales = useTemplateTextFontScales(model.elementRefs)
  const selectedRef = interaction.state.selectedKey
    ? renderedRefsByKey.get(interaction.state.selectedKey)
    : undefined
  const editingRef = interaction.state.editingKey
    ? renderedRefsByKey.get(interaction.state.editingKey)
    : undefined
  const editableTextElement =
    editingRef?.element.kind === 'text' || editingRef?.element.kind === 'shape'
      ? editingRef.element
      : undefined
  const selectedElementSupportsTextEditing =
    selectedRef?.element.kind === 'text' || selectedRef?.element.kind === 'shape'
  const unsupportedShapes = useMemo(
    () =>
      model.elementRefs.filter(
        (elementRef) =>
          elementRef.element.kind === 'shape' &&
          !SUPPORTED_SHAPE_NAMES.has(elementRef.element.shape),
      ),
    [model.elementRefs],
  )

  useEffect(() => {
    if (import.meta.env.DEV && unsupportedShapes.length > 0) {
      console.warn(
        'Unsupported SVG slide shapes:',
        unsupportedShapes.map((elementRef) => ({
          key: elementRef.key,
          shape: elementRef.element.kind === 'shape' ? elementRef.element.shape : undefined,
        })),
      )
    }
  }, [unsupportedShapes])

  if (!model.slide) {
    return (
      <div className={['slide-canvas-empty', className].filter(Boolean).join(' ')}>
        Unable to render this slide template.
      </div>
    )
  }

  const slide = model.slide
  return (
    <div
      className={['svg-slide-canvas', className].filter(Boolean).join(' ')}
      ref={containerRef}
      style={{ '--slide-canvas-bg': toSvgColor(slide.backgroundColor) } as CSSProperties}
    >
      <SvgSlideViewport
        clipId={`${canvasId}-root-clip`}
        onKeyDown={interaction.handleKeyDown}
        onPointerMove={interaction.handlePointerMove}
        onPointerUp={interaction.handlePointerUp}
        slide={slide}
        svgRef={svgRef}
        viewportSize={viewportSize}
      >
        <SvgSlide
          canvasId={canvasId}
          editingKey={interaction.state.editingKey}
          elementRefs={renderedRefs}
          onElementDoubleClick={interaction.startTextEditing}
          onElementPointerDown={interaction.beginDrag}
          onSlidePointerDown={(event: ReactPointerEvent<SVGRectElement>) => {
            event.stopPropagation()
            interaction.selectElement()
          }}
          slide={slide}
          textFontScales={textFontScales}
        />
        {selectedRef && !interaction.state.editingKey ? (
          <SvgSelection
            elementRef={selectedRef}
            onLinePointPointerDown={interaction.beginLinePointMove}
            onResizePointerDown={interaction.beginResize}
          />
        ) : null}
      </SvgSlideViewport>

      {selectedElementSupportsTextEditing && !interaction.state.editingKey ? (
        <div className="svg-slide-edit-hint" role="status">
          Click again, double-click, or press Enter to edit text
        </div>
      ) : null}

      {editableTextElement ? (
        <SvgTextEditorOverlay
          containerRef={containerRef}
          element={editableTextElement}
          fontScale={
            interaction.state.editingKey
              ? textFontScales.get(interaction.state.editingKey)
              : undefined
          }
          key={interaction.state.editingKey}
          onCancel={interaction.cancelTextEditing}
          onCommit={interaction.commitText}
          svgRef={svgRef}
        />
      ) : null}

      {import.meta.env.DEV && unsupportedShapes.length > 0 ? (
        <div className="svg-slide-diagnostic" role="status">
          {unsupportedShapes.length} unsupported slide shape
          {unsupportedShapes.length === 1 ? '' : 's'}
        </div>
      ) : null}
    </div>
  )
}

function useTemplateTextFontScales(elementRefs: ReturnType<typeof buildSlideCanvasModel>['elementRefs']) {
  const templateKey = getSvgTextScaleTemplateKey(elementRefs)
  const cachedScalesRef = useRef<{
    fontScales: Map<string, number>
    templateKey: string
  }>()

  if (!cachedScalesRef.current || cachedScalesRef.current.templateKey !== templateKey) {
    cachedScalesRef.current = {
      fontScales: getConsistentSvgTextFontScales(elementRefs),
      templateKey,
    }
  }

  return cachedScalesRef.current.fontScales
}

function useFittedViewportSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  slideWidth?: number,
  slideHeight?: number,
) {
  const [size, setSize] = useState<{ height: number; width: number }>()

  useEffect(() => {
    const container = containerRef.current
    if (!container || !slideWidth || !slideHeight) {
      return
    }

    const updateSize = () => {
      const availableWidth = Math.max(container.clientWidth - 32, 0)
      const availableHeight = Math.max(container.clientHeight - 32, 0)
      const scale = Math.min(availableWidth / slideWidth, availableHeight / slideHeight)
      const nextSize = {
        height: slideHeight * scale,
        width: slideWidth * scale,
      }

      setSize((currentSize) =>
        currentSize &&
        Math.abs(currentSize.height - nextSize.height) < 0.5 &&
        Math.abs(currentSize.width - nextSize.width) < 0.5
          ? currentSize
          : nextSize,
      )
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, slideHeight, slideWidth])

  return size
}
