import type { Node } from '@xyflow/react'

import {
  getConnectorAwareElementOrder,
  normalizePresentationSpec,
  type NormalizedElement,
  type NormalizedPresentation,
  type NormalizedSlide,
  type ValidationIssue,
} from '../export/PowerpointGenerator';

export type SlideFlowNodeData =
  | {
      kind: 'background'
      slide: Pick<NormalizedSlide, 'backgroundColor' | 'height' | 'name' | 'width'>
    }
  | {
      element: NormalizedElement
      kind: 'element'
      zIndex: number
    }

export interface SlideFlowModel {
  issues: ValidationIssue[]
  nodes: Node<SlideFlowNodeData>[]
  presentation?: NormalizedPresentation
  slide?: NormalizedSlide
}

export interface BuildSlideFlowModelOptions {
  slideIndex?: number
}

export function normalizeSlideFlowInput(input: unknown) {
  return normalizePresentationSpec(input)
}

export function buildSlideFlowModel(
  input: unknown,
  options: BuildSlideFlowModelOptions = {},
): SlideFlowModel {
  const { presentation, issues } = normalizeSlideFlowInput(input)
  const slide = presentation?.slides[options.slideIndex ?? 0]

  if (!slide) {
    return {
      issues,
      nodes: [],
      presentation,
    }
  }

  return {
    issues,
    nodes: buildNodes(slide),
    presentation,
    slide,
  }
}

function buildNodes(slide: NormalizedSlide): Node<SlideFlowNodeData>[] {
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
    ...getConnectorAwareElementOrder(slide).map((element, index) => {
      const geometry = getElementGeometry(element)
      const zIndex = index + 1

      return {
        id: element.id,
        type: 'slideElement',
        position: { x: geometry.x, y: geometry.y },
        selectable: true,
        draggable: true,
        deletable: false,
        data: {
          element,
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

function getElementGeometry(element: NormalizedElement) {
  if (element.kind !== 'line') {
    return {
      h: Math.max(element.h, 1),
      w: Math.max(element.w, 1),
      x: element.x,
      y: element.y,
    }
  }

  return {
    h: Math.max(Math.abs(element.y2 - element.y1), Math.max(element.strokeWidth, 1)),
    w: Math.max(Math.abs(element.x2 - element.x1), Math.max(element.strokeWidth, 1)),
    x: Math.min(element.x1, element.x2),
    y: Math.min(element.y1, element.y2),
  }
}
