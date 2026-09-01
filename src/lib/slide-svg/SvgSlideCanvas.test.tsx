import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import securitySpec from '../export/json-commentary-templates/slide-02-phase-1.compact copy.json'
import type { JsonObject, JsonValue } from '../shared/PowerpointTypes'
import { normalizeCommentaryTemplateSpec } from '../commentaryTemplates'
import { DIAGRAM_TEMPLATES } from '../diagramTemplates'
import { applyElementEditToInput, buildSlideCanvasModel } from '../slide-canvas'
import generatedArchitectureSpec from './fixtures/generated-architecture.json'
import { SUPPORTED_SHAPE_NAMES } from './shapes'
import { SvgSlideCanvas } from './SvgSlideCanvas'

const input = {
  presentation: {
    slides: [
      {
        id: 'test-slide',
        name: 'Test slide',
        width: 1280,
        height: 720,
        backgroundColor: 'FFFFFF',
        elements: [
          {
            id: 'shape-1',
            kind: 'shape',
            shape: 'triangle',
            x: 100,
            y: 100,
            w: 100,
            h: 80,
            fill: 'FFC700',
            stroke: '070154',
            label: 'Impact',
          },
          {
            id: 'line-1',
            kind: 'line',
            lineType: 'elbow',
            x1: 40,
            y1: 40,
            x2: 240,
            y2: 180,
            stroke: '070154',
            endArrow: 'triangle',
          },
        ],
      },
    ],
  },
}

const richTextInput = {
  presentation: {
    slides: [
      {
        id: 'rich-slide',
        name: 'Rich text slide',
        width: 1280,
        height: 720,
        backgroundColor: 'FFFFFF',
        elements: [
          {
            id: 'rich-text',
            type: 'text',
            x: 100,
            y: 100,
            w: 600,
            h: 120,
            text: 'Heading copy\nBody copy',
            align: 'left',
            valign: 'top',
            fontSize: 16,
            textColor: '111827',
            runs: [
              {
                text: 'Heading copy',
                bold: true,
                color: '111827',
                fontFace: 'Arial',
                fontSize: 16,
                breakLine: true,
              },
              {
                text: 'Body copy',
                color: '111827',
                fontFace: 'Arial',
                fontSize: 12,
                breakLine: true,
              },
            ],
          },
        ],
      },
    ],
  },
}

const rotatedLineInput = {
  presentation: {
    slides: [
      {
        id: 'rotated-line-slide',
        name: 'Rotated line slide',
        width: 1280,
        height: 720,
        backgroundColor: 'FFFFFF',
        elements: [
          {
            id: 'rotated-line',
            type: 'line',
            x1: 100,
            y1: 100,
            x2: 200,
            y2: 100,
            rotate: 90,
            stroke: '070154',
            strokeWidth: 1,
          },
        ],
      },
    ],
  },
}

describe('SvgSlideCanvas', () => {
  it('renders one keyed SVG group per element with a clipped slide viewport', () => {
    const { container, getByRole } = render(<SvgSlideCanvas input={input} />)
    const svg = getByRole('application')

    expect(svg.getAttribute('viewBox')).toBe('0 0 1280 720')
    expect(container.querySelectorAll('[data-element-key]')).toHaveLength(2)
    expect(container.querySelector('clipPath[id$="root-clip"]')).not.toBeNull()
    expect(container.querySelector('polygon')).not.toBeNull()
    expect(container.querySelector('path[marker-end]')).not.toBeNull()
    const footer = container.querySelector('[data-brand-footer]')
    const logo = container.querySelector('[data-brand-logo]')

    expect(footer?.getAttribute('x')).toBe('0')
    expect(footer?.getAttribute('y')).toBe('645')
    expect(footer?.getAttribute('width')).toBe('1280')
    expect(footer?.getAttribute('height')).toBe('75')
    expect(logo?.getAttribute('x')).toBe('48.33')
    expect(logo?.getAttribute('y')).toBe('664.08')
    expect(logo?.getAttribute('width')).toBe('153')
    expect(logo?.getAttribute('height')).toBe('32.02')
  })

  it('uses unique definition ids across repeated canvases', () => {
    const { container } = render(
      <>
        <SvgSlideCanvas input={input} />
        <SvgSlideCanvas input={input} />
      </>,
    )
    const ids = Array.from(container.querySelectorAll('[id]')).map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('honors imported-deck metadata for branding and PowerPoint z-order', () => {
    const importedInput = {
      presentation: {
        preserveElementOrder: true,
        showBranding: false,
        slides: [
          {
            id: 'imported-slide',
            name: 'Imported slide',
            width: 1280,
            height: 720,
            elements: [input.presentation.slides[0].elements[0], input.presentation.slides[0].elements[1]],
          },
        ],
      },
    }
    const { container } = render(<SvgSlideCanvas input={importedInput} />)
    const elements = Array.from(container.querySelectorAll('[data-element-key]'))

    expect(container.querySelector('[data-brand-footer]')).toBeNull()
    expect(elements[0].classList.contains('svg-slide-element-shape')).toBe(true)
    expect(elements[1].classList.contains('svg-slide-element-line')).toBe(true)
  })

  it('provides toolbar zoom and fit controls without changing slide geometry', () => {
    const { container, getByRole } = render(<SvgSlideCanvas input={input} />)
    const content = container.querySelector('[data-slide-viewport-content]')!

    fireEvent.click(getByRole('button', { name: 'Zoom in' }))
    expect(content.getAttribute('transform')).toContain('scale(1.25)')
    expect(getByRole('button', { name: /Fit 125%/ })).toBeDefined()

    fireEvent.click(getByRole('button', { name: /Fit 125%/ }))
    expect(content.getAttribute('transform')).toBe('translate(0 0) scale(1)')
    expect(getByRole('application').getAttribute('viewBox')).toBe('0 0 1280 720')
  })

  it('zooms around wheel and pinch gestures and pans the enlarged slide', () => {
    const { container, getByLabelText, getByRole } = render(<SvgSlideCanvas input={input} />)
    const background = getByLabelText('Test slide')
    const content = container.querySelector('[data-slide-viewport-content]')!
    const svg = getByRole('application')

    fireEvent.wheel(svg, { clientX: 640, clientY: 360, deltaY: -120 })
    expect(content.getAttribute('transform')).not.toContain('scale(1)')

    const beforePan = content.getAttribute('transform')
    fireEvent.pointerDown(background, {
      button: 0,
      clientX: 500,
      clientY: 300,
      pointerId: 1,
    })
    fireEvent.pointerMove(svg, { clientX: 525, clientY: 325, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 525, clientY: 325, pointerId: 1 })
    expect(content.getAttribute('transform')).not.toBe(beforePan)

    fireEvent.click(getByRole('button', { name: /Fit/ }))
    fireEvent.pointerDown(background, {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 2,
      pointerType: 'touch',
    })
    fireEvent.pointerDown(background, {
      button: 0,
      clientX: 600,
      clientY: 300,
      pointerId: 3,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(svg, {
      clientX: 700,
      clientY: 300,
      pointerId: 3,
      pointerType: 'touch',
    })
    expect(content.getAttribute('transform')).not.toContain('scale(1)')
    fireEvent.pointerUp(svg, { pointerId: 2, pointerType: 'touch' })
    fireEvent.pointerUp(svg, { pointerId: 3, pointerType: 'touch' })
  })

  it('supports keyboard focus, movement announcements, and visible selection state', () => {
    const onChange = vi.fn()
    const { container } = render(<SvgSlideCanvas input={input} onChange={onChange} />)
    const shape = container.querySelector<SVGGElement>(
      '[data-element-key]:not(.svg-slide-element-line)',
    )!

    expect(shape.tabIndex).toBe(0)
    fireEvent.focus(shape)
    expect(shape.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(shape, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as typeof input
    expect(updated.presentation.slides[0].elements[0]).toMatchObject({ x: 101, y: 100 })
    expect(container.querySelector('.svg-slide-live-region')?.textContent).toContain(
      'moved to 101, 100',
    )
  })

  it('keeps rotated line hit targets, selection, and endpoint edits aligned', () => {
    const onChange = vi.fn()
    const { container, getByRole } = render(
      <SvgSlideCanvas input={rotatedLineInput} onChange={onChange} />,
    )
    const line = container.querySelector<SVGGElement>('.svg-slide-element-line')!
    const hitTarget = line.querySelector<SVGPathElement>('.svg-slide-hit-target')!
    const visibleTransform = line.querySelector<SVGGElement>('g[transform]')?.getAttribute('transform')

    expect(visibleTransform).toBe('rotate(90 150 100)')
    expect(hitTarget.getAttribute('transform')).toBe(visibleTransform)

    fireEvent.focus(line)
    const selection = container.querySelector<SVGGElement>('.svg-slide-selection')!
    expect(selection.getAttribute('transform')).toBe(visibleTransform)

    const startHandle = selection.querySelector<SVGCircleElement>(
      '[aria-label="Move line start"]',
    )!
    const svg = getByRole('application')
    fireEvent.pointerDown(startHandle, {
      button: 0,
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    })
    fireEvent.pointerMove(svg, { clientX: 160, clientY: 50, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 160, clientY: 50, pointerId: 1 })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(
      (onChange.mock.calls[0][0] as typeof rotatedLineInput).presentation.slides[0].elements[0],
    ).toMatchObject({ x1: 105, y1: 95, x2: 205, y2: 105 })
  })

  it('additively selects elements and moves them in one JSON commit', () => {
    const onChange = vi.fn()
    const { container, getByRole } = render(
      <SvgSlideCanvas input={input} onChange={onChange} />,
    )
    const shape = container.querySelector<SVGGElement>(
      '[data-element-key]:not(.svg-slide-element-line)',
    )!
    const line = container.querySelector<SVGGElement>('.svg-slide-element-line')!
    const svg = getByRole('application')

    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerDown(line, {
      button: 0,
      clientX: 40,
      clientY: 40,
      pointerId: 2,
      shiftKey: true,
    })
    fireEvent.pointerUp(svg, { clientX: 40, clientY: 40, pointerId: 2 })

    expect(shape.getAttribute('aria-pressed')).toBe('true')
    expect(line.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(svg, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as typeof input
    expect(updated.presentation.slides[0].elements[0]).toMatchObject({ x: 101, y: 100 })
    expect(updated.presentation.slides[0].elements[1]).toMatchObject({ x1: 41, x2: 241 })
    expect(container.querySelector('.svg-slide-live-region')?.textContent).toContain(
      '2 elements moved',
    )

    fireEvent.keyDown(svg, { key: 'Delete' })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(
      (onChange.mock.calls[1][0] as typeof input).presentation.slides[0].elements,
    ).toHaveLength(0)
    expect(container.querySelector('.svg-slide-live-region')?.textContent).toContain(
      '2 elements deleted',
    )
  })

  it('selects intersecting elements with a Shift-drag selection box', () => {
    const { container, getByLabelText, getByRole } = render(<SvgSlideCanvas input={input} />)
    const background = getByLabelText('Test slide')
    const svg = getByRole('application')

    fireEvent.pointerDown(background, {
      button: 0,
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      shiftKey: true,
    })
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 300, pointerId: 1 })
    expect(container.querySelector('.svg-slide-selection-box')).not.toBeNull()
    fireEvent.pointerUp(svg, { clientX: 300, clientY: 300, pointerId: 1 })

    expect(container.querySelectorAll('[data-element-key][aria-pressed="true"]')).toHaveLength(2)
    expect(container.querySelector('.svg-slide-selection-box')).toBeNull()
  })

  it('commits a drag once on pointer-up and never during pointer movement', () => {
    const onChange = vi.fn()
    const { container, getByRole } = render(
      <SvgSlideCanvas input={input} onChange={onChange} />,
    )
    const shape = container.querySelector<SVGGElement>('[data-element-key]:not(.svg-slide-element-line)')!
    const svg = getByRole('application')

    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 125, clientY: 140, pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(svg, { clientX: 125, clientY: 140, pointerId: 1 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as typeof input
    expect(updated.presentation.slides[0].elements[0]).toMatchObject({ x: 125, y: 140 })
  })

  it('opens an SVG-native HTML editor on double-click and commits changed text on blur', () => {
    const onChange = vi.fn()
    const { container, getByLabelText } = render(
      <SvgSlideCanvas input={input} onChange={onChange} />,
    )
    const shape = container.querySelector<SVGGElement>('[data-element-key]:not(.svg-slide-element-line)')!
    fireEvent.doubleClick(shape)

    const editor = getByLabelText('Edit slide text') as HTMLDivElement
    expect(editor.closest('.svg-slide-text-editor')).not.toBeNull()
    expect(editor.closest('svg')).toBeNull()
    expect(editor.textContent).toBe('Impact')
    expect(shape.querySelector('text')).toBeNull()
    editor.textContent = 'Changed impact'
    fireEvent.input(editor)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(editor)

    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as typeof input
    expect(updated.presentation.slides[0].elements[0]).toMatchObject({
      label: 'Changed impact',
      text: 'Changed impact',
    })
  })

  it('opens the editor when an already-selected text element is clicked again', () => {
    const { container, getByLabelText, queryByLabelText, getByRole } = render(
      <SvgSlideCanvas input={input} onChange={vi.fn()} />,
    )
    const shape = container.querySelector<SVGGElement>(
      '[data-element-key]:not(.svg-slide-element-line)',
    )!
    const svg = getByRole('application')

    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100, pointerId: 1 })
    expect(queryByLabelText('Edit slide text')).toBeNull()

    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 2 })
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100, pointerId: 2 })

    expect(getByLabelText('Edit slide text').textContent).toBe('Impact')
  })

  it('opens the editor with Enter for a selected editable element', () => {
    const { container, getByLabelText, getByRole } = render(
      <SvgSlideCanvas input={input} onChange={vi.fn()} />,
    )
    const shape = container.querySelector<SVGGElement>(
      '[data-element-key]:not(.svg-slide-element-line)',
    )!
    const svg = getByRole('application')

    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.keyDown(svg, { key: 'Enter' })

    expect(getByLabelText('Edit slide text').textContent).toBe('Impact')
  })

  it('keeps a second pointer gesture as a drag when the selected element moves', () => {
    const onChange = vi.fn()
    const { container, getByRole, queryByLabelText } = render(
      <SvgSlideCanvas input={input} onChange={onChange} />,
    )
    const shape = container.querySelector<SVGGElement>(
      '[data-element-key]:not(.svg-slide-element-line)',
    )!
    const svg = getByRole('application')

    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerDown(shape, { button: 0, clientX: 100, clientY: 100, pointerId: 2 })
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 130, pointerId: 2 })
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 130, pointerId: 2 })

    expect(queryByLabelText('Edit slide text')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as typeof input
    expect(updated.presentation.slides[0].elements[0]).toMatchObject({ x: 120, y: 130 })
  })

  it('edits styled paragraphs as one commit group', () => {
    const onChange = vi.fn()
    const { container, getByLabelText } = render(
      <SvgSlideCanvas input={richTextInput} onChange={onChange} />,
    )
    const textElement = container.querySelector<SVGGElement>('[data-element-key]')!
    fireEvent.doubleClick(textElement)

    const heading = getByLabelText('Edit slide text') as HTMLDivElement
    const body = getByLabelText('Edit slide text paragraph 2') as HTMLDivElement
    expect(heading.style.fontWeight).toBe('700')
    expect(body.style.fontWeight).toBe('400')

    heading.textContent = 'Updated heading'
    fireEvent.input(heading)
    fireEvent.blur(heading, { relatedTarget: body })
    expect(onChange).not.toHaveBeenCalled()
    body.textContent = 'Updated body'
    fireEvent.input(body)
    fireEvent.blur(body)

    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as typeof richTextInput
    expect(updated.presentation.slides[0].elements[0]).toMatchObject({
      text: 'Updated heading\nUpdated body',
    })
  })

  it('keeps paragraph font sizes stable while typing', () => {
    const { container } = render(
      <SvgSlideCanvas input={richTextInput} onChange={vi.fn()} />,
    )
    const textElement = container.querySelector<SVGGElement>('[data-element-key]')!

    fireEvent.doubleClick(textElement)

    const editor = container.querySelector<HTMLElement>('.svg-slide-text-editor-content')!
    const paragraphs = editor.querySelectorAll<HTMLElement>('[data-editor-paragraph]')
    const initialFontSizes = Array.from(paragraphs, (paragraph) => paragraph.style.fontSize)
    paragraphs[0].textContent = 'A much longer heading that should not resize the body'
    fireEvent.input(paragraphs[0])

    expect(Array.from(paragraphs, (paragraph) => paragraph.style.fontSize)).toEqual(
      initialFontSizes,
    )
  })

  it('renders a representative Create-flow fixture without unsupported diagnostics', () => {
    const model = buildSlideCanvasModel(generatedArchitectureSpec, { resolveAssets: false })
    const { container } = render(<SvgSlideCanvas input={generatedArchitectureSpec} />)

    expect(model.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(container.querySelectorAll('[data-element-key]')).toHaveLength(
      model.elementRefs.length,
    )
    expect(container.querySelector('.svg-slide-diagnostic')).toBeNull()
    expect(container.querySelectorAll('tspan').length).toBeGreaterThanOrEqual(6)
  })

  it('uses consistent heading and body sizes across peer detail sections', () => {
    const input = normalizeCommentaryTemplateSpec(securitySpec)
    const { container, rerender } = render(
      <SvgSlideCanvas input={input} />,
    )
    const sectionPrefixes = [
      'Target has a foundation',
      'Although secure design',
      'Security testing encompasses',
      'Secure release practices',
      'Third-party component',
    ]
    const sections = sectionPrefixes.map((prefix) =>
      container.querySelector<SVGGElement>(`[data-element-key][aria-label^="${prefix}"]`)!,
    )
    const headingSizes = sections.map(
      (section) => section.querySelector('tspan[font-weight="700"]')?.getAttribute('font-size'),
    )
    const bodySizes = sections.map(
      (section) => section.querySelector('tspan[font-weight="400"]')?.getAttribute('font-size'),
    )

    expect(new Set(headingSizes).size).toBe(1)
    expect(new Set(bodySizes).size).toBe(1)
    expect(Number(headingSizes[0])).toBeGreaterThan(Number(bodySizes[0]))

    const model = buildSlideCanvasModel(input, { resolveAssets: false })
    const releasePracticesRef = model.elementRefs.find(
      (elementRef) => elementRef.element.id === 'element-19',
    )!
    const releasePracticesText =
      releasePracticesRef.element.kind === 'text'
        ? releasePracticesRef.element.text
        : ''
    const updatedInput = applyElementEditToInput(input, releasePracticesRef, {
      text: `${releasePracticesText} Additional supporting copy that would normally trigger a smaller auto-fit scale after blur.`,
    })

    rerender(<SvgSlideCanvas input={updatedInput} />)

    const updatedSections = sectionPrefixes.map((prefix) =>
      container.querySelector<SVGGElement>(`[data-element-key][aria-label^="${prefix}"]`)!,
    )
    expect(
      updatedSections.map(
        (section) => section.querySelector('tspan[font-weight="700"]')?.getAttribute('font-size'),
      ),
    ).toEqual(headingSizes)
    expect(
      updatedSections.map(
        (section) => section.querySelector('tspan[font-weight="400"]')?.getAttribute('font-size'),
      ),
    ).toEqual(bodySizes)
  })
})

describe('architecture diagram SVG compatibility', () => {
  it.each(DIAGRAM_TEMPLATES)(
    'renders every element, line feature, and rich-text block in $name',
    (template) => {
      const model = buildSlideCanvasModel(template.jsonSpec, { resolveAssets: false })
      const { container } = render(
        <SvgSlideCanvas input={template.jsonSpec} showBranding={false} />,
      )
      const shapeRefs = model.elementRefs.filter(
        (elementRef) => elementRef.element.kind === 'shape',
      )
      const lineRefs = model.elementRefs.filter(
        (elementRef) => elementRef.element.kind === 'line',
      )
      const arrowCount = lineRefs.filter(
        (elementRef) =>
          elementRef.element.kind === 'line' && elementRef.element.endArrow !== 'none',
      ).length
      const maskedLineCount = lineRefs.filter(
        (elementRef) =>
          elementRef.element.kind === 'line' && elementRef.element.occlusionRects.length > 0,
      ).length

      expect(model.issues.filter((issue) => issue.level === 'error')).toEqual([])
      expect(new Set(model.elementRefs.map((elementRef) => elementRef.key)).size).toBe(
        model.elementRefs.length,
      )
      expect(container.querySelectorAll('[data-element-key]')).toHaveLength(
        model.elementRefs.length,
      )
      expect(
        shapeRefs.every(
          (elementRef) =>
            elementRef.element.kind === 'shape' &&
            SUPPORTED_SHAPE_NAMES.has(elementRef.element.shape),
        ),
      ).toBe(true)
      expect(container.querySelectorAll('.svg-slide-element-line')).toHaveLength(
        lineRefs.length,
      )
      expect(container.querySelectorAll('path[marker-end]')).toHaveLength(arrowCount)
      expect(container.querySelectorAll('mask')).toHaveLength(maskedLineCount)
      expect(container.querySelector('.svg-slide-diagnostic')).toBeNull()
      expect(container.querySelector('clipPath[id$="root-clip"]')).not.toBeNull()
      expect(container.querySelectorAll('tspan').length).toBeGreaterThan(0)
    },
  )

  it('locks the checked-in architecture inventory at 192 elements and 284 text runs', () => {
    const elementRefs = DIAGRAM_TEMPLATES.flatMap(
      (template) =>
        buildSlideCanvasModel(template.jsonSpec, { resolveAssets: false }).elementRefs,
    )
    const runCount = DIAGRAM_TEMPLATES.reduce(
      (total, template) => total + countRawTextRuns(template.jsonSpec),
      0,
    )

    expect(elementRefs).toHaveLength(192)
    expect(elementRefs.filter(({ element }) => element.kind === 'shape')).toHaveLength(145)
    expect(elementRefs.filter(({ element }) => element.kind === 'line')).toHaveLength(36)
    expect(elementRefs.filter(({ element }) => element.kind === 'text')).toHaveLength(11)
    expect(runCount).toBe(284)
  })
})

function countRawTextRuns(value: JsonValue | undefined): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + countRawTextRuns(item), 0)
  }
  if (!isJsonObject(value)) {
    return 0
  }

  return Object.entries(value).reduce(
    (total, [key, item]) =>
      total + (key === 'runs' && Array.isArray(item) ? item.length : countRawTextRuns(item)),
    0,
  )
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
