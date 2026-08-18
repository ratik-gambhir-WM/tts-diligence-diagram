import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import securitySpec from '../export/json-commentary-templates/slide-02-phase-1.compact copy.json'
import { normalizeCommentaryTemplateSpec } from '../commentaryTemplates'
import { applyElementEditToInput, buildSlideCanvasModel } from '../slide-canvas'
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

describe('SvgSlideCanvas', () => {
  it('renders one keyed SVG group per element with a clipped slide viewport', () => {
    const { container, getByRole } = render(<SvgSlideCanvas input={input} />)
    const svg = getByRole('application')

    expect(svg.getAttribute('viewBox')).toBe('0 0 1280 720')
    expect(container.querySelectorAll('[data-element-key]')).toHaveLength(2)
    expect(container.querySelector('clipPath[id$="root-clip"]')).not.toBeNull()
    expect(container.querySelector('polygon')).not.toBeNull()
    expect(container.querySelector('path[marker-end]')).not.toBeNull()
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
