import { extractElementTransform } from './PowerpointGeometry'
import { EMU_PER_INCH, PX_PER_INCH } from '../shared/PowerpointConstants'
import type { XmlNode } from '../shared/PowerpointTypes'
import type { ExtractedElementRecord, TransformMatrix } from './PowerpointImportTypes'
import {
  positiveInt,
  positiveNumber,
  round,
  sum,
} from './PowerpointImportUtils'
import { extractNonVisual } from './PowerpointShapeUtils'
import {
  cloneColorNode,
  cloneNode,
  extractText,
  isDarkHex,
  schemeColorFallback,
} from './PowerpointText'
import { child, children, descendants, findDescendant, hasChild } from './PowerpointXml'

export function extractTableElements(
  node: XmlNode,
  matrix: TransformMatrix,
  pathLabel: string,
  baseIndex: number,
): ExtractedElementRecord[] {
  const table = findDescendant(node, 'a:tbl')
  if (!table) {
    return []
  }

  const nonVisual = extractNonVisual(node)
  const frame = extractElementTransform(node, matrix)
  const rows = children(table, 'a:tr')
  const gridColumns = children(child(table, 'a:tblGrid'), 'a:gridCol')
  const columnCount = Math.max(
    gridColumns.length,
    ...rows.map((row) => children(row, 'a:tc').reduce((sum, cell) => sum + positiveInt(cell.attributes?.gridSpan, 1), 0)),
    1,
  )
  const columnWidths = resolveTablePartSizes(
    gridColumns.map((column) => Number(column.attributes?.w) || 0),
    columnCount,
    frame.widthPx,
  )
  const rowHeights = resolveTablePartSizes(
    rows.map((row) => Number(row.attributes?.h) || 0),
    Math.max(rows.length, 1),
    frame.heightPx,
    tableAutoRowWeights(rows, columnWidths),
  )
  const totalColumnWidth = positiveNumber(sum(columnWidths), 1)
  const totalRowHeight = positiveNumber(sum(rowHeights), 1)
  const elements: ExtractedElementRecord[] = []
  const fallbackLine = tableDefaultLine(table)

  rows.forEach((row, rowIndex) => {
    let columnIndex = 0

    for (const cell of children(row, 'a:tc')) {
      const gridSpan = Math.min(positiveInt(cell.attributes?.gridSpan, 1), columnCount - columnIndex)
      const rowSpan = Math.min(positiveInt(cell.attributes?.rowSpan, 1), rows.length - rowIndex)

      if (cell.attributes?.hMerge === '1' || cell.attributes?.vMerge === '1') {
        columnIndex += gridSpan
        continue
      }

      const cellWidth = (frame.widthPx * sum(columnWidths.slice(columnIndex, columnIndex + gridSpan))) / totalColumnWidth
      const cellHeight = (frame.heightPx * sum(rowHeights.slice(rowIndex, rowIndex + rowSpan))) / totalRowHeight
      const cellX = frame.xPx + (frame.widthPx * sum(columnWidths.slice(0, columnIndex))) / totalColumnWidth
      const cellY = frame.yPx + (frame.heightPx * sum(rowHeights.slice(0, rowIndex))) / totalRowHeight
      const idBase = nonVisual.id ? nonVisual.id * 1000 : (baseIndex + 1) * 1000

      elements.push({
        path: `${pathLabel}#table[${baseIndex + 1}].row[${rowIndex + 1}].cell[${columnIndex + 1}]`,
        zIndex: baseIndex + elements.length / 1000,
        tag: 'a:tc',
        kind: 'shape',
        nonVisual: {
          id: idBase + rowIndex * 100 + columnIndex + 1,
          name: `${nonVisual.name || 'Table'} Cell ${rowIndex + 1}-${columnIndex + 1}`,
          hidden: nonVisual.hidden,
        },
        transform: {
          xPx: round(cellX),
          yPx: round(cellY),
          widthPx: round(cellWidth),
          heightPx: round(cellHeight),
          rotation: frame.rotation,
          xInches: round(cellX / PX_PER_INCH, 4),
          yInches: round(cellY / PX_PER_INCH, 4),
          widthInches: round(cellWidth / PX_PER_INCH, 4),
          heightInches: round(cellHeight / PX_PER_INCH, 4),
        },
        presetGeometry: {
          preset: 'rect',
        },
        relationshipIds: [],
        xmlAst: cell,
        text: extractText(child(cell, 'a:txBody')),
        shapeProperties: tableCellShapeProperties(cell, fallbackLine),
        style: tableCellTextStyle(cell),
      })

      columnIndex += gridSpan
    }
  })

  return elements
}

function tableCellShapeProperties(cell: XmlNode, fallbackLine: XmlNode | undefined): XmlNode {
  const tcPr = child(cell, 'a:tcPr')
  const fill = cloneNode(child(tcPr, 'a:solidFill'))
  const line = tableCellLineNode(tcPr) ?? cloneNode(fallbackLine)
  const shapeProperties: XmlNode = {
    tag: 'p:spPr',
    children: [],
  }

  if (fill) {
    shapeProperties.children?.push(fill)
  } else {
    shapeProperties.children?.push({ tag: 'a:noFill', children: [] })
  }

  if (line) {
    shapeProperties.children?.push(line)
  }

  return shapeProperties
}

function tableCellLineNode(tcPr: XmlNode | undefined): XmlNode | undefined {
  const border = ['a:lnB', 'a:lnT', 'a:lnL', 'a:lnR']
    .map((tag) => child(tcPr, tag))
    .find((line) => line && !hasChild(line, 'a:noFill'))
  if (!border) {
    return undefined
  }

  return {
    ...cloneNode(border),
    tag: 'a:ln',
  }
}

function tableDefaultLine(table: XmlNode): XmlNode | undefined {
  const visibleLine = descendants(table, 'a:tcPr')
    .flatMap((tcPr) => ['a:lnB', 'a:lnT', 'a:lnL', 'a:lnR'].map((tag) => child(tcPr, tag)))
    .find((line) => line && !hasChild(line, 'a:noFill'))

  if (!visibleLine) {
    return undefined
  }

  return {
    ...cloneNode(visibleLine),
    tag: 'a:ln',
  }
}

function tableCellTextStyle(cell: XmlNode): XmlNode {
  const txBody = child(cell, 'a:txBody')
  const runColor = descendants(txBody, 'a:rPr')
    .map((runProperties) => cloneColorNode(child(runProperties, 'a:solidFill')))
    .find((colorNode) => !!colorNode)
  const fillColor = tableCellFillColor(child(cell, 'a:tcPr'))
  const fallbackColor = fillColor && isDarkHex(fillColor) ? 'FFFFFF' : '111827'

  return {
    tag: 'p:style',
    children: [
      {
        tag: 'a:fontRef',
        children: [runColor ?? { tag: 'a:srgbClr', attributes: { val: fallbackColor }, children: [] }],
      },
    ],
  }
}

function tableCellFillColor(tcPr: XmlNode | undefined) {
  const colorNode = cloneColorNode(child(tcPr, 'a:solidFill'))
  if (!colorNode) {
    return undefined
  }

  if (colorNode.tag === 'a:srgbClr') {
    return colorNode.attributes?.val
  }

  if (colorNode.tag === 'a:sysClr') {
    return colorNode.attributes?.lastClr || colorNode.attributes?.val
  }

  if (colorNode.tag === 'a:schemeClr') {
    return schemeColorFallback(colorNode.attributes?.val)
  }

  return undefined
}

/**
 * PowerPoint uses `0` for auto-sized table rows. Mixing that zero with explicit
 * EMU heights as a literal `1` makes the explicit row consume almost the entire
 * table. Preserve explicit sizes and distribute the frame's remaining space
 * across auto-sized rows instead.
 */
function resolveTablePartSizes(
  values: number[],
  count: number,
  totalSizePx: number,
  autoWeights: number[] = [],
) {
  const sourceValues = Array.from({ length: count }, (_, index) => values[index] ?? 0)
  const explicitSizes = sourceValues.map((value) => (value > 0 ? (value / EMU_PER_INCH) * PX_PER_INCH : 0))
  const missingIndexes = explicitSizes
    .map((value, index) => (value > 0 ? -1 : index))
    .filter((index) => index >= 0)
  const targetSize = Math.max(totalSizePx, 0)

  if (!missingIndexes.length) {
    return scaleTableParts(explicitSizes, targetSize)
  }

  const explicitTotal = explicitSizes.reduce((total, value) => total + value, 0)
  const remainingSize = targetSize - explicitTotal
  const resolved = [...explicitSizes]

  if (remainingSize > 0) {
    const missingWeightTotal = missingIndexes.reduce(
      (total, index) => total + positiveNumber(autoWeights[index], 1),
      0,
    )
    for (const index of missingIndexes) {
      resolved[index] = (remainingSize * positiveNumber(autoWeights[index], 1)) / missingWeightTotal
    }
    return resolved
  }

  const explicitPerWeight = explicitSizes
    .map((value, index) => value / positiveNumber(autoWeights[index], 1))
    .filter((value) => value > 0)
    .sort((left, right) => left - right)
  const typicalSizePerWeight =
    explicitPerWeight[Math.floor(explicitPerWeight.length / 2)] || targetSize / Math.max(count, 1) || 1

  for (const index of missingIndexes) {
    resolved[index] = typicalSizePerWeight * positiveNumber(autoWeights[index], 1)
  }

  return scaleTableParts(resolved, targetSize)
}

function scaleTableParts(values: number[], totalSizePx: number) {
  const currentTotal = values.reduce((total, value) => total + value, 0)
  if (currentTotal <= 0) {
    return values.map(() => totalSizePx / Math.max(values.length, 1))
  }
  return values.map((value) => (value * totalSizePx) / currentTotal)
}

function tableAutoRowWeights(rows: XmlNode[], columnWidths: number[]) {
  return rows.map((row) => {
    let columnIndex = 0
    let rowWeight = 1

    for (const cell of children(row, 'a:tc')) {
      const gridSpan = Math.min(
        positiveInt(cell.attributes?.gridSpan, 1),
        Math.max(columnWidths.length - columnIndex, 1),
      )
      const cellWidth = columnWidths
        .slice(columnIndex, columnIndex + gridSpan)
        .reduce((total, width) => total + width, 0)

      if (cell.attributes?.hMerge !== '1' && cell.attributes?.vMerge !== '1') {
        const lineCount = estimateTableCellLineCount(cell, cellWidth)
        const rowSpan = positiveInt(cell.attributes?.rowSpan, 1)
        rowWeight = Math.max(rowWeight, (1 + Math.max(lineCount - 1, 0) * 0.5) / rowSpan)
      }

      columnIndex += gridSpan
    }

    return rowWeight
  })
}

function estimateTableCellLineCount(cell: XmlNode, cellWidthPx: number) {
  const textBody = extractText(child(cell, 'a:txBody'))
  const logicalLines = (textBody?.plainText ?? '').split('\n')
  const fontSizePoints = tableCellFontSizePoints(cell)
  const tcPr = child(cell, 'a:tcPr')
  const leftInset = tableCellInsetPx(tcPr?.attributes?.marL)
  const rightInset = tableCellInsetPx(tcPr?.attributes?.marR)
  const availableWidth = Math.max(cellWidthPx - leftInset - rightInset, fontSizePoints)
  const averageCharacterWidth = Math.max(fontSizePoints * (PX_PER_INCH / 72) * 0.46, 1)
  const lineCapacity = Math.max(Math.floor(availableWidth / averageCharacterWidth), 1)

  return Math.max(
    logicalLines.reduce(
      (total, line) => total + Math.max(Math.ceil(Math.max(line.trim().length, 1) / lineCapacity), 1),
      0,
    ),
    1,
  )
}

function tableCellFontSizePoints(cell: XmlNode) {
  const textBody = child(cell, 'a:txBody')
  const sizeNode = [...descendants(textBody, 'a:rPr'), ...descendants(textBody, 'a:defRPr'), ...descendants(textBody, 'a:endParaRPr')]
    .find((node) => Number(node.attributes?.sz) > 0)
  const size = Number(sizeNode?.attributes?.sz)
  return Number.isFinite(size) && size > 0 ? size / 100 : 12
}

function tableCellInsetPx(value: string | undefined) {
  const emu = Number(value)
  return Number.isFinite(emu) && emu >= 0 ? (emu / EMU_PER_INCH) * PX_PER_INCH : PX_PER_INCH * 0.1
}
