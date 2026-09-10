import { describe, expect, it } from 'vitest'

import architectureSpec from '../export/json-commentary-templates/slide-01-phase-1.compact copy.json'
import securitySpec from '../export/json-commentary-templates/slide-02-phase-1.compact copy.json'
import sdlcSpec from '../export/json-commentary-templates/slide-03-phase-1.compact copy.json'
import microserviceArchitectureSpec from '../export/json-slide-templates/microservice-arch.json'
import { normalizeCommentaryTemplateSpec } from '../commentaryTemplates'
import {
  applyElementEditsToInput,
  applyElementEditToInput,
  deleteElementsFromInput,
} from './edits'
import { buildSlideCanvasModel } from './model'
import { getElementGeometry, getLinePathPoints } from './geometry'
import type { EditableCanvasLineElement } from '../canvas-model/CanvasTypes'

describe('slide canvas model', () => {
  it('includes a rotated elbow bend in line geometry', () => {
    const line: EditableCanvasLineElement = {
      beginArrow: 'none',
      dash: 'solid',
      endArrow: 'none',
      id: 'rotated-elbow',
      kind: 'line',
      lineType: 'elbow',
      occlusionRects: [],
      opacity: 1,
      rotate: 45,
      sourcePath: 'slides[0].elements[0]',
      stroke: '070154',
      strokeOpacity: 1,
      strokeWidth: 1,
      valign: 'middle',
      x1: 0,
      x2: 100,
      y1: 0,
      y2: 100,
    }

    const geometry = getElementGeometry(line)
    expect(geometry.h).toBeCloseTo(141.42, 2)
    expect(geometry.w).toBeCloseTo(70.71, 2)
    expect(geometry.x).toBeCloseTo(-20.71, 2)
    expect(geometry.y).toBeCloseTo(-20.71, 2)
  })

  it.each([
    {
      expected: [{ x: 20, y: 30 }, { x: 20, y: 80 }, { x: 220, y: 80 }],
      name: 'vertical-first when horizontal travel dominates',
      points: { x1: 20, y1: 30, x2: 220, y2: 80 },
    },
    {
      expected: [{ x: 220, y: 180 }, { x: 220, y: 150 }, { x: 40, y: 150 }],
      name: 'vertical-first with reversed horizontal travel',
      points: { x1: 220, y1: 180, x2: 40, y2: 150 },
    },
    {
      expected: [{ x: 20, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 230 }],
      name: 'horizontal-first when vertical travel dominates',
      points: { x1: 20, y1: 30, x2: 70, y2: 230 },
    },
    {
      expected: [{ x: 20, y: 30 }, { x: 20, y: 230 }],
      name: 'straight when endpoints are vertically aligned',
      points: { x1: 20, y1: 30, x2: 20, y2: 230 },
    },
  ])('routes an elbow $name', ({ expected, points }) => {
    const line: EditableCanvasLineElement = {
      beginArrow: 'none',
      dash: 'solid',
      endArrow: 'triangle',
      id: 'dynamic-elbow',
      kind: 'line',
      lineType: 'elbow',
      occlusionRects: [],
      opacity: 1,
      rotate: 0,
      sourcePath: 'slides[0].elements[0]',
      stroke: '070154',
      strokeOpacity: 1,
      strokeWidth: 1,
      valign: 'middle',
      ...points,
    }

    expect(getLinePathPoints(line)).toEqual(expected)
  })

  it('routes the product-architecture backbone toward the integration groups', () => {
    const model = buildSlideCanvasModel(microserviceArchitectureSpec, { resolveAssets: false })
    const connector = model.slide?.elements.find(
      (element): element is EditableCanvasLineElement =>
        element.kind === 'line' && element.id === 'element-6',
    )

    expect(connector).toMatchObject({
      lineType: 'elbow',
      elbowDirection: 'horizontal-first',
    })
    if (!connector) {
      throw new Error('Expected the product-architecture backbone connector.')
    }
    expect(getLinePathPoints(connector)).toEqual([
      { x: 501.89, y: 271.09 },
      { x: 524.1, y: 271.09 },
      { x: 524.1, y: 339.73 },
    ])
  })

  it.each([
    {
      direction: 'horizontal-first' as const,
      expected: [{ x: 20, y: 30 }, { x: 220, y: 30 }, { x: 220, y: 80 }],
    },
    {
      direction: 'vertical-first' as const,
      expected: [{ x: 20, y: 30 }, { x: 20, y: 80 }, { x: 220, y: 80 }],
    },
  ])('honors an explicit $direction elbow route', ({ direction, expected }) => {
    const line: EditableCanvasLineElement = {
      beginArrow: 'none',
      dash: 'solid',
      elbowDirection: direction,
      endArrow: 'triangle',
      id: `explicit-${direction}`,
      kind: 'line',
      lineType: 'elbow',
      occlusionRects: [],
      opacity: 1,
      rotate: 0,
      sourcePath: 'slides[0].elements[0]',
      stroke: '070154',
      strokeOpacity: 1,
      strokeWidth: 1,
      valign: 'middle',
      x1: 20,
      x2: 220,
      y1: 30,
      y2: 80,
    }

    expect(getLinePathPoints(line)).toEqual(expected)
  })

  it.each([
    ['architecture', architectureSpec, 59],
    ['security', securitySpec, 55],
    ['sdlc', sdlcSpec, 60],
  ])('normalizes the %s commentary fixture and retains off-slide content', (_, spec, count) => {
    const normalizedInput = normalizeCommentaryTemplateSpec(spec)
    const model = buildSlideCanvasModel(normalizedInput, { resolveAssets: false })

    expect(model.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(model.elementRefs).toHaveLength(count)
    expect(new Set(model.elementRefs.map((elementRef) => elementRef.key)).size).toBe(count)
    expect(
      model.elementRefs.some(
        (elementRef) =>
          elementRef.element.kind !== 'line' &&
          elementRef.element.x + elementRef.element.w > (model.slide?.width ?? 1280),
      ),
    ).toBe(true)
  })

  it('removes only branded image assets when a text element reuses the logo id', () => {
    const model = buildSlideCanvasModel(normalizeCommentaryTemplateSpec(architectureSpec), {
      resolveAssets: false,
    })
    const reusedIdElements = model.elementRefs.filter(
      (elementRef) => elementRef.element.id === 'element-5',
    )

    expect(reusedIdElements).toHaveLength(1)
    expect(reusedIdElements[0].element.kind).toBe('text')
  })
})

describe('source-path element mutations', () => {
  const duplicateIdInput = {
    presentation: {
      slides: [
        {
          id: 'slide-1',
          width: 1280,
          height: 720,
          elements: [
            { id: 'duplicate', kind: 'text', x: 10, y: 20, w: 100, h: 40, text: 'First' },
            { id: 'duplicate', kind: 'text', x: 30, y: 40, w: 100, h: 40, text: 'Second' },
          ],
        },
      ],
    },
  }

  it('edits the exact element even when raw ids and kinds are duplicated', () => {
    const model = buildSlideCanvasModel(duplicateIdInput, { resolveAssets: false })
    const secondRef = model.elementRefs.find((elementRef) =>
      elementRef.sourcePath.endsWith('elements[1]'),
    )
    expect(secondRef).toBeDefined()

    const updated = applyElementEditToInput(duplicateIdInput, secondRef!, { text: 'Changed' })
    const elements = updated.presentation.slides[0].elements
    expect(elements[0].text).toBe('First')
    expect(elements[1].text).toBe('Changed')
    expect(duplicateIdInput.presentation.slides[0].elements[1].text).toBe('Second')
  })

  it('deletes only the selected duplicate-id element', () => {
    const model = buildSlideCanvasModel(duplicateIdInput, { resolveAssets: false })
    const firstRef = model.elementRefs.find((elementRef) =>
      elementRef.sourcePath.endsWith('elements[0]'),
    )
    expect(firstRef).toBeDefined()

    const updated = deleteElementsFromInput(duplicateIdInput, [firstRef!])
    expect(updated.presentation.slides[0].elements).toHaveLength(1)
    expect(updated.presentation.slides[0].elements[0].text).toBe('Second')
  })

  it('applies a group edit in one immutable update', () => {
    const model = buildSlideCanvasModel(duplicateIdInput, { resolveAssets: false })
    const updated = applyElementEditsToInput(
      duplicateIdInput,
      model.elementRefs.map((locator, index) => ({
        edit: { x: 100 + index * 20, y: 200 + index * 20 },
        locator,
      })),
    )

    expect(updated.presentation.slides[0].elements).toMatchObject([
      { text: 'First', x: 100, y: 200 },
      { text: 'Second', x: 120, y: 220 },
    ])
    expect(duplicateIdInput.presentation.slides[0].elements[0]).toMatchObject({ x: 10, y: 20 })
  })

  it('preserves normal body runs when editing a box with a bold heading', () => {
    const input = normalizeCommentaryTemplateSpec(securitySpec)
    const model = buildSlideCanvasModel(input, { resolveAssets: false })
    const detailRef = model.elementRefs.find(
      (elementRef) => elementRef.element.id === 'element-14',
    )
    expect(detailRef?.element.kind).toBe('text')

    const currentText =
      detailRef?.element.kind === 'text' ? detailRef.element.text : ''
    const updated = applyElementEditToInput(input, detailRef!, {
      text: currentText.replace('Target has a foundation', 'Target has a strong foundation'),
    }) as {
      presentation: {
        slides: Array<{
          elements: Array<{
            id?: string
            runs?: Array<{ bold?: boolean; fontFace?: string; fontSize?: number }>
          }>
        }>
      }
    }
    const editedElement = updated.presentation.slides[0].elements.find(
      (element) => element.id === 'element-14',
    )

    expect(editedElement?.runs?.map((run) => run.bold)).toEqual([true, false, false])
    expect(editedElement?.runs?.map((run) => run.fontSize)).toEqual([11, 9, 9])
    expect(editedElement?.runs?.map((run) => run.fontFace)).toEqual([
      'ヒラギノ角ゴ Pro W3',
      'Arial',
      'Arial',
    ])
  })
})
