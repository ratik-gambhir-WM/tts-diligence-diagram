import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { JsonValue } from '../canvas-model/CanvasTypes'
import { SvgSlidePreview } from './SvgSlidePreview'

const input: JsonValue = {
  presentation: {
    preserveElementOrder: true,
    showBranding: false,
    slides: [{
      backgroundColor: 'FFFFFF',
      elements: [{
        color: '070154',
        fill: 'transparent',
        fontFace: 'Arial',
        fontSize: 20,
        h: 60,
        id: 'title',
        text: 'Preview title',
        type: 'text',
        w: 400,
        x: 40,
        y: 40,
      }],
      height: 720,
      id: 'slide-1',
      name: 'Preview slide',
      width: 1280,
    }],
    title: 'Preview test',
  },
}

afterEach(() => {
  delete window.__TTS_MERMAID_TEMPLATE_PREVIEW_INPUT__
})

describe('SvgSlidePreview', () => {
  it('renders only the slide surface at the requested maximum dimension', () => {
    const { container } = render(<SvgSlidePreview input={input} maxDimension={1600} />)

    expect(container.querySelector('[data-preview-state="ready"]')).not.toBeNull()
    const surface = container.querySelector('[data-template-preview-surface]')
    expect(surface?.getAttribute('width')).toBe('1600')
    expect(surface?.getAttribute('height')).toBe('900')
    expect(surface?.getAttribute('viewBox')).toBe('0 0 1280 720')
    expect(container.querySelector('.svg-slide-viewport-controls')).toBeNull()
    expect(container.textContent).toContain('Preview title')
  })

  it('reports an error rather than exposing a capture surface for invalid JSON', () => {
    const { container } = render(<SvgSlidePreview input={{}} maxDimension={1600} />)

    expect(container.querySelector('[data-preview-state="error"]')).not.toBeNull()
    expect(container.querySelector('[data-template-preview-surface]')).toBeNull()
  })
})
