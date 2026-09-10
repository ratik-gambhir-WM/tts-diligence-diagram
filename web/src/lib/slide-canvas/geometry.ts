import type { EditableCanvasElement, EditableCanvasLineElement } from '../canvas-model/CanvasTypes'
import { normalizeElbowDirection } from '../canvas-model/CanvasUtils'

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

export type LinePathPoint = {
  x: number
  y: number
}

export type RenderedLinePoints = {
  x1: number
  x2: number
  y1: number
  y2: number
}

export function getRenderedLinePoints(element: EditableCanvasLineElement): RenderedLinePoints {
  const points = getRenderedLinePathPoints(element)
  const start = points[0]
  const end = points[points.length - 1]

  return {
    x1: start.x,
    x2: end.x,
    y1: start.y,
    y2: end.y,
  }
}

export function getLinePathPoints(element: EditableCanvasLineElement): LinePathPoint[] {
  const start = { x: element.x1, y: element.y1 }
  const end = { x: element.x2, y: element.y2 }
  const deltaX = Math.abs(element.x2 - element.x1)
  const deltaY = Math.abs(element.y2 - element.y1)

  if (element.lineType !== 'elbow' || deltaX <= 0.5 || deltaY <= 0.5) {
    return [start, end]
  }

  const direction = normalizeElbowDirection(
    element.elbowDirection,
    element.x1,
    element.y1,
    element.x2,
    element.y2,
  )
  const bend = direction === 'vertical-first'
    ? { x: element.x1, y: element.y2 }
    : { x: element.x2, y: element.y1 }

  return [start, bend, end]
}

function getRenderedLinePathPoints(element: EditableCanvasLineElement): LinePathPoint[] {
  const points = getLinePathPoints(element)

  if (!element.rotate) {
    return points
  }

  const centerX = (element.x1 + element.x2) / 2
  const centerY = (element.y1 + element.y2) / 2
  return points.map((point) => rotatePoint(point.x, point.y, centerX, centerY, element.rotate))
}

export function getElementGeometry(element: EditableCanvasElement): BoxGeometry {
  if (element.kind !== 'line') {
    return {
      h: Math.max(element.h, 1),
      w: Math.max(element.w, 1),
      x: element.x,
      y: element.y,
    }
  }

  const points = getRenderedLinePathPoints(element)
  const xCoordinates = points.map((point) => point.x)
  const yCoordinates = points.map((point) => point.y)
  const minX = Math.min(...xCoordinates)
  const maxX = Math.max(...xCoordinates)
  const minY = Math.min(...yCoordinates)
  const maxY = Math.max(...yCoordinates)
  return {
    h: Math.max(maxY - minY, Math.max(element.strokeWidth, 1)),
    w: Math.max(maxX - minX, Math.max(element.strokeWidth, 1)),
    x: minX,
    y: minY,
  }
}

function rotatePoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  degrees: number,
): LinePathPoint {
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const offsetX = x - centerX
  const offsetY = y - centerY

  return {
    x: centerX + offsetX * cosine - offsetY * sine,
    y: centerY + offsetX * sine + offsetY * cosine,
  }
}

export function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

export function getElementAccessibleLabel(element: EditableCanvasElement) {
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
