import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

import type { NormalizedElement } from '../export/PowerpointTypes'
import {
  applyElementEditToInput,
  deleteElementsFromInput,
  roundCoordinate,
  type ElementEdit,
  type SlideElementRef,
} from '../slide-canvas'

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export type SvgInteractionState = {
  draftEdit?: ElementEdit
  editingKey?: string
  mode: 'idle' | 'dragging' | 'resizing' | 'editing-text' | 'moving-line-point'
  selectedKey?: string
}

type InteractionAction =
  | { type: 'cancel' }
  | { edit: ElementEdit; mode: SvgInteractionState['mode']; type: 'draft' }
  | { key: string; type: 'edit-text' }
  | { key?: string; type: 'select' }
  | { type: 'settle' }

type ActiveInteraction = {
  didMove: boolean
  handle?: ResizeHandle | 'line-end' | 'line-start'
  lastEdit?: ElementEdit
  mode: 'dragging' | 'resizing' | 'moving-line-point'
  openTextEditorOnClick: boolean
  pointerId: number
  ref: SlideElementRef
  startElement: NormalizedElement
  startPoint: { x: number; y: number }
}

type UseSvgInteractionOptions = {
  elementRefs: SlideElementRef[]
  input: unknown
  onChange?: (input: unknown) => void
  svgRef: RefObject<SVGSVGElement | null>
}

const INITIAL_STATE: SvgInteractionState = { mode: 'idle' }

export function useSvgInteraction({
  elementRefs,
  input,
  onChange,
  svgRef,
}: UseSvgInteractionOptions) {
  const [state, dispatch] = useReducer(interactionReducer, INITIAL_STATE)
  const activeRef = useRef<ActiveInteraction | undefined>(undefined)
  const latestInputRef = useRef(input)
  const latestOnChangeRef = useRef(onChange)
  latestInputRef.current = input
  latestOnChangeRef.current = onChange
  const refsByKey = useMemo(
    () => new Map(elementRefs.map((elementRef) => [elementRef.key, elementRef])),
    [elementRefs],
  )

  useEffect(() => {
    if (state.selectedKey && !refsByKey.has(state.selectedKey)) {
      dispatch({ type: 'select' })
    }
  }, [refsByKey, state.selectedKey])

  const selectElement = useCallback((key?: string) => {
    dispatch({ key, type: 'select' })
  }, [])

  const begin = useCallback(
    (
      ref: SlideElementRef,
      event: ReactPointerEvent<SVGElement>,
      mode: ActiveInteraction['mode'],
      handle?: ActiveInteraction['handle'],
    ) => {
      if (event.button !== 0 || state.editingKey) {
        return
      }

      const svg = svgRef.current
      const startPoint = svg ? clientPointToSlide(svg, event.clientX, event.clientY) : undefined
      if (!svg || !startPoint) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      svg.focus({ preventScroll: true })
      svg.setPointerCapture(event.pointerId)
      activeRef.current = {
        didMove: false,
        handle,
        mode,
        openTextEditorOnClick:
          mode === 'dragging' &&
          state.selectedKey === ref.key &&
          (ref.element.kind === 'shape' || ref.element.kind === 'text'),
        pointerId: event.pointerId,
        ref,
        startElement: ref.element,
        startPoint,
      }
      dispatch({ key: ref.key, type: 'select' })
      dispatch({ edit: {}, mode, type: 'draft' })
    },
    [state.editingKey, state.selectedKey, svgRef],
  )

  const beginDrag = useCallback(
    (ref: SlideElementRef, event: ReactPointerEvent<SVGElement>) =>
      begin(ref, event, 'dragging'),
    [begin],
  )

  const beginResize = useCallback(
    (
      ref: SlideElementRef,
      handle: ResizeHandle,
      event: ReactPointerEvent<SVGElement>,
    ) => begin(ref, event, 'resizing', handle),
    [begin],
  )

  const beginLinePointMove = useCallback(
    (
      ref: SlideElementRef,
      point: 'end' | 'start',
      event: ReactPointerEvent<SVGElement>,
    ) => begin(ref, event, 'moving-line-point', point === 'start' ? 'line-start' : 'line-end'),
    [begin],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = activeRef.current
      const svg = svgRef.current
      if (!active || !svg || event.pointerId !== active.pointerId) {
        return
      }

      const point = clientPointToSlide(svg, event.clientX, event.clientY)
      if (!point) {
        return
      }

      const dx = point.x - active.startPoint.x
      const dy = point.y - active.startPoint.y

      if (active.mode === 'dragging' && !active.didMove && Math.hypot(dx, dy) < 3) {
        return
      }

      active.didMove = true
      const edit = getInteractionEdit(active, dx, dy)
      active.lastEdit = edit
      dispatch({ edit, mode: active.mode, type: 'draft' })
    },
    [svgRef],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      if (svgRef.current?.hasPointerCapture(event.pointerId)) {
        svgRef.current.releasePointerCapture(event.pointerId)
      }

      activeRef.current = undefined
      if (active.openTextEditorOnClick && !active.didMove && !active.lastEdit) {
        dispatch({ key: active.ref.key, type: 'edit-text' })
        return
      }

      if (active.lastEdit && latestOnChangeRef.current) {
        latestOnChangeRef.current(
          applyElementEditToInput(latestInputRef.current, active.ref, active.lastEdit),
        )
      }
      dispatch({ type: 'settle' })
    },
    [svgRef],
  )

  const startTextEditing = useCallback((ref: SlideElementRef) => {
    if (ref.element.kind === 'shape' || ref.element.kind === 'text') {
      dispatch({ key: ref.key, type: 'edit-text' })
    }
  }, [])

  const commitText = useCallback(
    (text: string) => {
      const ref = state.editingKey ? refsByKey.get(state.editingKey) : undefined
      if (ref && latestOnChangeRef.current) {
        const currentText = ref.element.kind === 'text'
          ? ref.element.text
          : ref.element.kind === 'shape'
            ? ref.element.label
            : ''
        if (text !== currentText) {
          latestOnChangeRef.current(
            applyElementEditToInput(latestInputRef.current, ref, { text }),
          )
        }
      }
      dispatch({ type: 'settle' })
    },
    [refsByKey, state.editingKey],
  )

  const cancelTextEditing = useCallback(() => {
    dispatch({ type: 'settle' })
  }, [])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<SVGSVGElement>) => {
      if (!state.selectedKey || state.editingKey) {
        return
      }

      const ref = refsByKey.get(state.selectedKey)
      if (!ref) {
        return
      }

      if (
        event.key === 'Enter' &&
        (ref.element.kind === 'shape' || ref.element.kind === 'text')
      ) {
        event.preventDefault()
        dispatch({ key: ref.key, type: 'edit-text' })
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        latestOnChangeRef.current?.(
          deleteElementsFromInput(latestInputRef.current, [ref]),
        )
        dispatch({ type: 'select' })
        return
      }

      if (event.key === 'Escape') {
        activeRef.current = undefined
        dispatch({ type: 'cancel' })
        return
      }

      const distance = event.shiftKey ? 10 : 1
      const delta = getArrowDelta(event.key, distance)
      if (!delta) {
        return
      }

      event.preventDefault()
      latestOnChangeRef.current?.(
        applyElementEditToInput(latestInputRef.current, ref, getNudgeEdit(ref.element, delta)),
      )
    },
    [refsByKey, state.editingKey, state.selectedKey],
  )

  return {
    beginDrag,
    beginLinePointMove,
    beginResize,
    cancelTextEditing,
    commitText,
    handleKeyDown,
    handlePointerMove,
    handlePointerUp,
    selectElement,
    startTextEditing,
    state,
  }
}

function interactionReducer(
  state: SvgInteractionState,
  action: InteractionAction,
): SvgInteractionState {
  switch (action.type) {
    case 'select':
      return {
        mode: 'idle',
        selectedKey: action.key,
      }
    case 'draft':
      return {
        ...state,
        draftEdit: action.edit,
        mode: action.mode,
      }
    case 'edit-text':
      return {
        editingKey: action.key,
        mode: 'editing-text',
        selectedKey: action.key,
      }
    case 'cancel':
    case 'settle':
      return {
        mode: 'idle',
        selectedKey: state.selectedKey,
      }
  }
}

function clientPointToSlide(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM()?.inverse()
  if (!matrix) {
    return undefined
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix)
  return { x: point.x, y: point.y }
}

function getInteractionEdit(active: ActiveInteraction, dx: number, dy: number): ElementEdit {
  const element = active.startElement
  if (active.mode === 'dragging') {
    if (element.kind === 'line') {
      return {
        x1: roundCoordinate(element.x1 + dx),
        x2: roundCoordinate(element.x2 + dx),
        y1: roundCoordinate(element.y1 + dy),
        y2: roundCoordinate(element.y2 + dy),
      }
    }
    return {
      x: roundCoordinate(element.x + dx),
      y: roundCoordinate(element.y + dy),
    }
  }

  if (active.mode === 'moving-line-point' && element.kind === 'line') {
    return active.handle === 'line-start'
      ? { x1: roundCoordinate(element.x1 + dx), y1: roundCoordinate(element.y1 + dy) }
      : { x2: roundCoordinate(element.x2 + dx), y2: roundCoordinate(element.y2 + dy) }
  }

  if (element.kind === 'line' || !active.handle) {
    return {}
  }

  return getResizeEdit(element, active.handle as ResizeHandle, dx, dy)
}

function getResizeEdit(
  element: Exclude<NormalizedElement, { kind: 'line' }>,
  handle: ResizeHandle,
  dx: number,
  dy: number,
) {
  const movesWest = handle.includes('w')
  const movesEast = handle.includes('e')
  const movesNorth = handle.includes('n')
  const movesSouth = handle.includes('s')
  let x = element.x
  let y = element.y
  let w = element.w
  let h = element.h

  if (movesWest) {
    const nextWidth = Math.max(36, element.w - dx)
    x = element.x + element.w - nextWidth
    w = nextWidth
  } else if (movesEast) {
    w = Math.max(36, element.w + dx)
  }

  if (movesNorth) {
    const nextHeight = Math.max(24, element.h - dy)
    y = element.y + element.h - nextHeight
    h = nextHeight
  } else if (movesSouth) {
    h = Math.max(24, element.h + dy)
  }

  return {
    h: roundCoordinate(h),
    w: roundCoordinate(w),
    x: roundCoordinate(x),
    y: roundCoordinate(y),
  }
}

function getArrowDelta(key: string, distance: number) {
  if (key === 'ArrowLeft') return { x: -distance, y: 0 }
  if (key === 'ArrowRight') return { x: distance, y: 0 }
  if (key === 'ArrowUp') return { x: 0, y: -distance }
  if (key === 'ArrowDown') return { x: 0, y: distance }
  return undefined
}

function getNudgeEdit(element: NormalizedElement, delta: { x: number; y: number }): ElementEdit {
  if (element.kind === 'line') {
    return {
      x1: roundCoordinate(element.x1 + delta.x),
      x2: roundCoordinate(element.x2 + delta.x),
      y1: roundCoordinate(element.y1 + delta.y),
      y2: roundCoordinate(element.y2 + delta.y),
    }
  }
  return {
    x: roundCoordinate(element.x + delta.x),
    y: roundCoordinate(element.y + delta.y),
  }
}
