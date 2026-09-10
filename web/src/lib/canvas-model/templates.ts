import type { JsonValue } from '../canvas-model/CanvasTypes'

export type CanvasTemplate = {
  description: string
  id: string
  image: string
  jsonSpec: JsonValue
  name: string
  relatedAlt: string
}
