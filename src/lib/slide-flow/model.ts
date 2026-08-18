import type { Node } from '@xyflow/react'

import {
  buildSlideCanvasModel,
  getElementGeometry,
  type BuildSlideCanvasModelOptions,
  type SlideCanvasModel,
  type SlideElementRef,
} from '../slide-canvas'
import type { NormalizedSlide } from '../export/PowerpointTypes'

export type SlideFlowNodeData =
  | {
      kind: 'background'
      slide: Pick<NormalizedSlide, 'backgroundColor' | 'height' | 'name' | 'width'>
    }
  | {
      element: SlideElementRef['element']
      elementRef: SlideElementRef
      kind: 'element'
      zIndex: number
    }

export interface SlideFlowModel extends SlideCanvasModel {
  nodes: Node<SlideFlowNodeData>[]
}

export type BuildSlideFlowModelOptions = BuildSlideCanvasModelOptions

export function normalizeSlideFlowInput(input: unknown) {
  return buildSlideCanvasModel(input)
}

export function buildSlideFlowModel(
  input: unknown,
  options: BuildSlideFlowModelOptions = {},
): SlideFlowModel {
  const model = buildSlideCanvasModel(input, options)

  return {
    ...model,
    nodes: model.slide ? buildNodes(model.slide, model.elementRefs) : [],
  }
}

function buildNodes(
  slide: NormalizedSlide,
  elementRefs: SlideElementRef[],
): Node<SlideFlowNodeData>[] {
  return [
    {
      id: `${slide.id}-background`,
      type: 'slideBackground',
      position: { x: 0, y: 0 },
      selectable: false,
      draggable: false,
      deletable: false,
      data: {
        kind: 'background',
        slide: {
          backgroundColor: slide.backgroundColor,
          height: slide.height,
          name: slide.name,
          width: slide.width,
        },
      },
      style: {
        height: slide.height,
        width: slide.width,
        zIndex: 0,
      },
      zIndex: 0,
    },
    ...elementRefs.map((elementRef, index) => {
      const geometry = getElementGeometry(elementRef.element)
      const zIndex = index + 1

      return {
        id: elementRef.key,
        type: 'slideElement',
        position: { x: geometry.x, y: geometry.y },
        selectable: true,
        draggable: true,
        deletable: true,
        data: {
          element: elementRef.element,
          elementRef,
          kind: 'element' as const,
          zIndex,
        },
        style: {
          height: geometry.h,
          width: geometry.w,
          zIndex,
        },
        zIndex,
      }
    }),
  ]
}
