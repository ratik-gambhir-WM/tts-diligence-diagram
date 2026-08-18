import type { NormalizedElement } from '../export/PowerpointTypes'

export type BoxGeometry = {
  h: number
  w: number
  x: number
  y: number
}

export type LineGeometry = {
  x1: number
  x2: number
  y1: number
  y2: number
}

export type ElementGeometry = BoxGeometry | LineGeometry

export function getElementGeometry(element: NormalizedElement): BoxGeometry {
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

export function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

export function getElementAccessibleLabel(element: NormalizedElement) {
  if (element.kind === 'text') {
    return element.text.trim() || 'Text element'
  }

  if (element.kind === 'shape') {
    return element.label.trim() || `${element.shape} shape`
  }

  if (element.kind === 'image') {
    return element.altText.trim() || 'Image element'
  }

  return `${element.lineType} line`
}

