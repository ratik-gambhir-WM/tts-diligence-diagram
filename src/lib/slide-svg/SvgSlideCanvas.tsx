import {
  useCallback,
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
  type SlideElementRef,
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
import { useSvgViewport } from './useSvgViewport'
import './svg-slide.css'

export interface SvgSlideCanvasProps {
  className?: string
  input: unknown
  onChange?: (input: unknown) => void
  showBranding?: boolean
  slideIndex?: number
}

export function SvgSlideCanvas({
  className,
  input,
  onChange,
  showBranding = true,
  slideIndex = 0,
}: SvgSlideCanvasProps) {
  const model = useMemo(
    () => buildSlideCanvasModel(input, { slideIndex }),
    [input, slideIndex],
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const coordinateRootRef = useRef<SVGGElement>(null)
  const reactId = useId()
  const canvasId = useMemo(() => `svg-slide-${sanitizeSvgId(reactId)}`, [reactId])
  const viewportSize = useFittedViewportSize(containerRef, model.slide?.width, model.slide?.height)
  const viewport = useSvgViewport({
    slideHeight: model.slide?.height ?? 720,
    slideWidth: model.slide?.width ?? 1280,
    svgRef,
  })
  const interaction = useSvgInteraction({
    coordinateRootRef,
    elementRefs: model.elementRefs,
    input,
    onChange,
    svgRef,
  })
  const renderedRefs = useMemo(
    () =>
      interaction.state.draftEdits
        ? model.elementRefs.map((elementRef) =>
            interaction.state.draftEdits?.has(elementRef.key)
              ? {
                  ...elementRef,
                  element: applyElementEdit(
                    elementRef.element,
                    interaction.state.draftEdits.get(elementRef.key) ?? {},
                  ),
                }
              : elementRef,
          )
        : model.elementRefs,
    [interaction.state.draftEdits, model.elementRefs],
  )
  const renderedRefsByKey = useMemo(
    () => new Map(renderedRefs.map((elementRef) => [elementRef.key, elementRef])),
    [renderedRefs],
  )
  const textFontScales = useTemplateTextFontScales(model.elementRefs)
  const selectedRef = interaction.state.primaryKey
    ? renderedRefsByKey.get(interaction.state.primaryKey)
    : undefined
  const editingRef = interaction.state.editingKey
    ? renderedRefsByKey.get(interaction.state.editingKey)
    : undefined
  const editableTextElement =
    editingRef?.element.kind === 'text' || editingRef?.element.kind === 'shape'
      ? editingRef.element
      : undefined
  const selectedElementSupportsTextEditing =
    interaction.state.selectedKeys.size === 1 &&
    (selectedRef?.element.kind === 'text' || selectedRef?.element.kind === 'shape')
  const selectedRefs = renderedRefs.filter((elementRef) =>
    interaction.state.selectedKeys.has(elementRef.key),
  )
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

  const handleElementPointerDown = useCallback(
    (elementRef: SlideElementRef, event: ReactPointerEvent<SVGElement>) => {
      if (!viewport.isPinching()) {
        interaction.beginDrag(elementRef, event)
      }
    },
    [interaction.beginDrag, viewport.isPinching],
  )
  const handleSlidePointerDown = useCallback(
    (event: ReactPointerEvent<SVGRectElement>) => {
      event.stopPropagation()
      if (event.shiftKey) {
        interaction.beginSelectionBox(event)
        return
      }
      interaction.selectElement()
      viewport.beginPan(event)
    },
    [interaction.beginSelectionBox, interaction.selectElement, viewport.beginPan],
  )
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (viewport.handlePointerMove(event)) {
        interaction.cancelActiveInteraction(false)
        return
      }
      interaction.handlePointerMove(event)
    },
    [interaction.cancelActiveInteraction, interaction.handlePointerMove, viewport.handlePointerMove],
  )
  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (viewport.handlePointerEnd(event)) {
        interaction.cancelActiveInteraction(false)
        return
      }
      interaction.handlePointerUp(event)
    },
    [interaction.cancelActiveInteraction, interaction.handlePointerUp, viewport.handlePointerEnd],
  )
  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      viewport.handlePointerEnd(event)
      interaction.cancelActiveInteraction()
    },
    [interaction.cancelActiveInteraction, viewport.handlePointerEnd],
  )

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
        contentRef={coordinateRootRef}
        contentTransform={viewport.transform}
        descriptionId={`${canvasId}-instructions`}
        id={canvasId}
        onKeyDown={interaction.handleKeyDown}
        onPointerCancel={handlePointerCancel}
        onPointerDownCapture={viewport.handlePointerDownCapture}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={viewport.handleWheel}
        slide={slide}
        svgRef={svgRef}
        viewportSize={viewportSize}
      >
        <SvgSlide
          canvasId={canvasId}
          editingKey={interaction.state.editingKey}
          elementRefs={renderedRefs}
          onElementDoubleClick={interaction.startTextEditing}
          onElementFocus={interaction.focusElement}
          onElementPointerDown={handleElementPointerDown}
          onSlidePointerDown={handleSlidePointerDown}
          selectedKeys={interaction.state.selectedKeys}
          showBranding={showBranding}
          slide={slide}
          textFontScales={textFontScales}
        />
        {!interaction.state.editingKey
          ? selectedRefs.map((elementRef) => (
              <SvgSelection
                elementRef={elementRef}
                key={`selection-${elementRef.key}`}
                onLinePointPointerDown={interaction.beginLinePointMove}
                onResizePointerDown={interaction.beginResize}
                showHandles={interaction.state.selectedKeys.size === 1}
                zoom={viewport.state.zoom}
              />
            ))
          : null}
        {interaction.state.selectionBox ? (
          <rect
            className="svg-slide-selection-box"
            height={interaction.state.selectionBox.h}
            pointerEvents="none"
            width={interaction.state.selectionBox.w}
            x={interaction.state.selectionBox.x}
            y={interaction.state.selectionBox.y}
          />
        ) : null}
      </SvgSlideViewport>

      <SvgViewportControls
        canvasId={canvasId}
        onReset={viewport.reset}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        zoom={viewport.state.zoom}
      />

      <p className="svg-slide-instructions" id={`${canvasId}-instructions`}>
        Tab through slide elements. Press Space to select, Enter to edit text, arrow keys to
        move, Shift plus arrow keys to move farther, and Delete to remove. Shift-drag the
        slide background to select multiple elements.
      </p>

      <div aria-live="polite" className="svg-slide-live-region" role="status">
        {interaction.announcement}
      </div>

      {selectedElementSupportsTextEditing && !interaction.state.editingKey ? (
        <div className="svg-slide-edit-hint" role="status">
          Click again, double-click, or press Enter to edit text
        </div>
      ) : null}

      {editableTextElement ? (
        <SvgTextEditorOverlay
          containerRef={containerRef}
          coordinateRootRef={coordinateRootRef}
          element={editableTextElement}
          fontScale={
            interaction.state.editingKey
              ? textFontScales.get(interaction.state.editingKey)
              : undefined
          }
          key={interaction.state.editingKey}
          onCancel={interaction.cancelTextEditing}
          onCommit={interaction.commitText}
          viewportTransform={viewport.transform}
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

function SvgViewportControls({
  canvasId,
  onReset,
  onZoomIn,
  onZoomOut,
  zoom,
}: {
  canvasId: string
  onReset: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  zoom: number
}) {
  return (
    <div aria-label="Canvas zoom controls" className="svg-slide-viewport-controls" role="toolbar">
      <button aria-controls={canvasId} aria-label="Zoom out" onClick={onZoomOut} type="button">
        −
      </button>
      <button aria-controls={canvasId} onClick={onReset} type="button">
        Fit {Math.round(zoom * 100)}%
      </button>
      <button aria-controls={canvasId} aria-label="Zoom in" onClick={onZoomIn} type="button">
        +
      </button>
    </div>
  )
}

function useTemplateTextFontScales(elementRefs: ReturnType<typeof buildSlideCanvasModel>['elementRefs']) {
  const templateKey = getSvgTextScaleTemplateKey(elementRefs)
  const cachedScalesRef = useRef<{
    fontScales: Map<string, number>
    templateKey: string
  } | undefined>(undefined)

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
