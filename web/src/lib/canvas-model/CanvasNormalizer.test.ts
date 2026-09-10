import { describe, expect, it } from 'vitest'

import { normalizePresentationSpec } from './CanvasNormalizer'

describe('PowerPoint normalization', () => {
  it('preserves direct slide dimensions from imported compact JSON', () => {
    const result = normalizePresentationSpec({
      presentation: {
        title: 'Imported 4:3 deck',
        slides: [
          {
            id: 'slide-1',
            name: 'Imported slide',
            width: 960,
            height: 720,
            backgroundColor: 'FFFFFF',
            elements: [],
          },
        ],
      },
    })

    expect(result.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(result.presentation?.meta).toMatchObject({ width: 960, height: 720 })
    expect(result.presentation?.slides[0]).toMatchObject({ width: 960, height: 720 })
  })

  it('keeps a theme-inherited outline when a shape has no explicit line node', () => {
    const result = normalizePresentationSpec({
      slideNumber: 1,
      slideSize: { widthPx: 1280, heightPx: 720 },
      shapeTree: {
        elements: [
          {
            kind: 'shape',
            path: 'shapeTree.elements[0]',
            nonVisual: { id: 2 },
            transform: { xPx: 10, yPx: 10, widthPx: 100, heightPx: 50 },
            presetGeometry: { preset: 'rect' },
            shapeProperties: {
              tag: 'p:spPr',
              children: [
                {
                  tag: 'a:solidFill',
                  children: [{ tag: 'a:srgbClr', attributes: { val: 'FFFFFF' } }],
                },
              ],
            },
            style: {
              tag: 'p:style',
              children: [
                {
                  tag: 'a:lnRef',
                  attributes: { idx: '2' },
                  children: [{ tag: 'a:srgbClr', attributes: { val: 'FF0000' } }],
                },
              ],
            },
          },
        ],
      },
    })

    expect(result.presentation?.slides[0].elements[0]).toMatchObject({
      kind: 'shape',
      stroke: 'FF0000',
      strokeWidth: 1,
    })
  })

  it('infers elbows only for non-aligned lines without an explicit line type', () => {
    const result = normalizePresentationSpec({
      presentation: {
        slides: [
          {
            width: 1280,
            height: 720,
            elements: [
              { type: 'line', id: 'horizontal', x1: 10, y1: 20, x2: 200, y2: 20 },
              { type: 'line', id: 'vertical', x1: 10, y1: 20, x2: 10, y2: 200 },
              { type: 'line', id: 'inferred-elbow', x1: 10, y1: 20, x2: 200, y2: 80 },
              {
                type: 'line',
                id: 'explicit-diagonal',
                lineType: 'straight',
                x1: 10,
                y1: 20,
                x2: 200,
                y2: 80,
              },
            ],
          },
        ],
      },
    })

    expect(result.presentation?.slides[0].elements.map((element) =>
      element.kind === 'line' ? element.lineType : undefined,
    )).toEqual(['straight', 'straight', 'elbow', 'straight'])
  })

  it('recognizes an imported PowerPoint bent connector preset as an elbow', () => {
    const result = normalizePresentationSpec({
      slideNumber: 1,
      slideSize: { widthPx: 1280, heightPx: 720 },
      shapeTree: {
        elements: [
          {
            kind: 'shape',
            path: 'shapeTree.elements[0]',
            nonVisual: { id: 7 },
            transform: { xPx: 80, yPx: 100, widthPx: 240, heightPx: 80 },
            presetGeometry: { preset: 'bentConnector2' },
            shapeProperties: { tag: 'p:spPr' },
          },
        ],
      },
    })

    expect(result.presentation?.slides[0].elements[0]).toMatchObject({
      kind: 'line',
      lineType: 'elbow',
      elbowDirection: 'horizontal-first',
      x1: 80,
      y1: 100,
      x2: 320,
      y2: 180,
    })
  })

  it('preserves an explicit elbow direction instead of re-guessing it from the aspect ratio', () => {
    const result = normalizePresentationSpec({
      presentation: {
        slides: [{
          elements: [{
            type: 'line',
            lineType: 'elbow',
            elbowDirection: 'horizontal-first',
            x1: 20,
            y1: 30,
            x2: 220,
            y2: 80,
          }],
        }],
      },
    })

    expect(result.presentation?.slides[0].elements[0]).toMatchObject({
      kind: 'line',
      lineType: 'elbow',
      elbowDirection: 'horizontal-first',
    })
  })
})
