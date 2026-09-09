import { DEFAULT_FONT_FACE } from '../shared/PowerpointConstants'
import type {
  NormalizedShapeElement,
  NormalizedTextElement,
  NormalizedTextRun,
  JsonObject,
  JsonValue,
} from '../shared/PowerpointTypes'

export function buildNormalizedTextRuns(
  element: NormalizedShapeElement | NormalizedTextElement,
  text: string,
): NormalizedTextRun[] {
  const existingRuns = element.kind === 'shape' ? element.textRuns : element.runs
  const fallbackRun = existingRuns[0]
  const lines = text.split('\n')

  return lines.map((line, index) => ({
    bold: existingRuns[index]?.bold ?? fallbackRun?.bold ?? element.bold,
    breakLine: index < lines.length - 1,
    color:
      existingRuns[index]?.color ??
      fallbackRun?.color ??
      ('color' in element ? element.color : element.textColor),
    fontFace: existingRuns[index]?.fontFace ?? fallbackRun?.fontFace ?? DEFAULT_FONT_FACE,
    fontSize: existingRuns[index]?.fontSize ?? fallbackRun?.fontSize ?? element.fontSize,
    italic:
      existingRuns[index]?.italic ??
      fallbackRun?.italic ??
      ('italic' in element ? element.italic : false),
    text: line,
    underline: existingRuns[index]?.underline ?? fallbackRun?.underline ?? false,
  }))
}

export function buildRawTextRuns(element: JsonObject, text: string) {
  const existingRuns = Array.isArray(element.runs) ? element.runs.filter(isRecord) : []
  const fallbackRun = existingRuns[0]
  const lines = text.split('\n')

  return lines.map((line, index) => {
    const matchingRun = existingRuns[index]
    const color =
      asString(matchingRun?.color) ||
      asString(fallbackRun?.color) ||
      asString(element.textColor) ||
      asString(element.color)
    const fontSize =
      asNumber(matchingRun?.fontSize) ??
      asNumber(fallbackRun?.fontSize) ??
      asNumber(element.fontSize)
    const bold = matchingRun
      ? (asBoolean(matchingRun.bold) ?? false)
      : (asBoolean(fallbackRun?.bold) ?? asBoolean(element.bold))
    const italic = matchingRun
      ? (asBoolean(matchingRun.italic) ?? false)
      : (asBoolean(fallbackRun?.italic) ?? asBoolean(element.italic))
    const underline = matchingRun
      ? (asBoolean(matchingRun.underline) ?? false)
      : asBoolean(fallbackRun?.underline)

    return {
      ...(bold !== undefined ? { bold } : undefined),
      breakLine: index < lines.length - 1,
      ...(color ? { color } : undefined),
      fontFace:
        asString(matchingRun?.fontFace) ||
        asString(fallbackRun?.fontFace) ||
        asString(element.fontFace) ||
        DEFAULT_FONT_FACE,
      ...(fontSize !== undefined ? { fontSize } : undefined),
      ...(italic !== undefined ? { italic } : undefined),
      text: line,
      ...(underline !== undefined ? { underline } : undefined),
    }
  })
}

function isRecord(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: JsonValue | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asBoolean(value: JsonValue | undefined) {
  return typeof value === 'boolean' ? value : undefined
}
