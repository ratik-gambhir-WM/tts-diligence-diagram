import { describe, expect, it } from 'vitest'

import { normalizePresentationSpec } from './PowerpointNormalizer'

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
})
