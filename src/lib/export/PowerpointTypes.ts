export type UnknownRecord = Record<string, unknown>

export interface XmlNode {
  tag: string
  attributes?: Record<string, string>
  children?: XmlNode[]
  text?: string
}

export interface ExtractedRelationship {
  Id: string
  Type?: string
  Target?: string
  resolvedTarget?: string
  typeShort?: string
}

export interface ExtractedSupportPart {
  path?: string
  size?: number
  relationshipType?: string
  contentTypeHint?: string
  base64?: string
  rawXml?: string
}

export interface ExtractedTransform {
  xPx?: number
  yPx?: number
  widthPx?: number
  heightPx?: number
  rotation?: number | null
  xInches?: number
  yInches?: number
  widthInches?: number
  heightInches?: number
}

export interface ExtractedTextRun {
  text?: string
  properties?: Record<string, string>
}

export interface ExtractedTextParagraph {
  runs?: ExtractedTextRun[]
  properties?: Record<string, string>
  endParagraphRunProperties?: Record<string, string>
}

export interface ExtractedTextBody {
  plainText?: string
  paragraphs?: ExtractedTextParagraph[]
  bodyProperties?: Record<string, string>
}

export interface ExtractedShapeElement {
  path?: string
  zIndex?: number
  tag?: string
  kind?: string
  nonVisual?: {
    id?: number
    name?: string
    hidden?: boolean
  }
  transform?: ExtractedTransform
  presetGeometry?: {
    preset?: string
    xmlAst?: XmlNode
  }
  relationshipIds?: string[]
  xmlAst?: XmlNode
  text?: ExtractedTextBody
  shapeProperties?: XmlNode
  style?: XmlNode
}

export interface ExtractedSlideSpec {
  slideNumber?: number
  slideSize?: {
    widthPx?: number
    heightPx?: number
    widthInches?: number
    heightInches?: number
  }
  relationships?: ExtractedRelationship[]
  shapeTree?: {
    elements?: ExtractedShapeElement[]
  }
  summary?: {
    totalDrawableElements?: number
    textElementCount?: number
  }
  supportParts?: Record<string, ExtractedSupportPart>
}

export type VerticalAlign = 'top' | 'middle' | 'bottom'
export type HorizontalAlign = 'left' | 'center' | 'right'
export type DashStyle = 'solid' | 'dash' | 'dot'

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface NormalizedTextRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  fontFace: string
  fontSize: number
  breakLine?: boolean
}

export interface BaseElement {
  id: string
  sourcePath: string
  opacity: number
  rotate: number
  valign: VerticalAlign
}

export interface NormalizedTextElement extends BaseElement {
  kind: 'text'
  x: number
  y: number
  w: number
  h: number
  text: string
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
  padding: number
  align: HorizontalAlign
  color: string
  fontSize: number
  fontFace: string
  bold: boolean
  italic: boolean
  runs: NormalizedTextRun[]
}

export interface NormalizedShapeElement extends BaseElement {
  kind: 'shape'
  x: number
  y: number
  w: number
  h: number
  shape: string
  label: string
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
  padding: number
  align: HorizontalAlign
  textColor: string
  fontSize: number
  fontFace: string
  bold: boolean
  textRuns: NormalizedTextRun[]
}

export interface NormalizedLineElement extends BaseElement {
  kind: 'line'
  lineType: 'straight' | 'elbow'
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
  dash: DashStyle
  endArrow: 'none' | 'triangle' | 'arrow' | 'diamond' | 'oval' | 'stealth'
  occlusionRects: LineOcclusionRect[]
}

export interface NormalizedImageElement extends BaseElement {
  kind: 'image'
  x: number
  y: number
  w: number
  h: number
  src: string
  fit: 'contain' | 'cover' | 'stretch'
  borderRadius: number
  altText: string
}

export type NormalizedElement =
  | NormalizedTextElement
  | NormalizedShapeElement
  | NormalizedLineElement
  | NormalizedImageElement

export interface LineOcclusionRect {
  x: number
  y: number
  w: number
  h: number
}

export interface NormalizedSlide {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  elements: NormalizedElement[]
}

export interface NormalizedPresentation {
  meta: {
    title: string
    width: number
    height: number
    sourceType: 'extracted-slide' | 'native-presentation'
  }
  slides: NormalizedSlide[]
}

export interface NormalizationOptions {
  baseDir?: string
}

export type SlideForElementLayering = Pick<NormalizedSlide, 'elements' | 'height' | 'width'>

export interface PowerPointWriteOptions {
  fileName: string
  compression?: boolean
  insertAfterSlide?: number
  targetFile?: File
  targetFileHandle?: PowerPointFileHandle
  writeMode?: 'copy' | 'overwrite'
}

export interface PowerPointFileHandle {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{
    write: (data: Blob | Uint8Array) => Promise<void>
    close: () => Promise<void>
  }>
}
