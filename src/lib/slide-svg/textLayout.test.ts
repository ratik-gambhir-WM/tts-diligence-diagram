import { describe, expect, it } from 'vitest'

import type { NormalizedTextRun } from '../shared/PowerpointTypes'
import { layoutSvgText } from './textLayout'

const baseRun: NormalizedTextRun = {
  bold: false,
  color: '070154',
  fontFace: 'Arial',
  fontSize: 20,
  italic: false,
  text: '',
  underline: false,
}

const measure = (text: string, _run: NormalizedTextRun, fontSize: number) =>
  text.length * fontSize * 0.5

describe('SVG text layout', () => {
  it('wraps mixed styled runs while preserving their styles', () => {
    const first = { ...baseRun, bold: true, text: 'Bold lead ' }
    const second = { ...baseRun, color: '1451E1', text: 'follow-up words' }
    const layout = layoutSvgText({
      align: 'left',
      fallbackRun: baseRun,
      fallbackText: '',
      height: 200,
      measure,
      padding: 0,
      runs: [first, second],
      valign: 'top',
      width: 130,
    })

    expect(layout.lines.length).toBeGreaterThan(1)
    expect(layout.lines.flatMap((line) => line.segments).some((segment) => segment.run === first)).toBe(true)
    expect(layout.lines.flatMap((line) => line.segments).some((segment) => segment.run === second)).toBe(true)
  })

  it('honors explicit breaks, center alignment, and bottom vertical alignment', () => {
    const layout = layoutSvgText({
      align: 'center',
      fallbackRun: baseRun,
      fallbackText: '',
      height: 100,
      measure,
      padding: 10,
      runs: [{ ...baseRun, breakLine: true, text: 'One' }, { ...baseRun, text: 'Two' }],
      valign: 'bottom',
      width: 120,
    })

    expect(layout.lines).toHaveLength(2)
    expect(layout.lines[0].segments[0].x).toBeGreaterThan(10)
    expect(layout.lines[1].baseline).toBeGreaterThan(70)
  })

  it('shrinks text to the minimum font scale when height is constrained', () => {
    const layout = layoutSvgText({
      align: 'left',
      fallbackRun: baseRun,
      fallbackText: 'A long block of text that must shrink to fit its box',
      height: 20,
      measure,
      padding: 2,
      runs: [],
      valign: 'top',
      width: 80,
    })

    expect(layout.fontScale).toBeLessThan(1)
    expect(layout.fontScale).toBeGreaterThanOrEqual(0.25)
  })

  it('honors a fixed font scale for peer text boxes', () => {
    const layout = layoutSvgText({
      align: 'left',
      fallbackRun: baseRun,
      fallbackText: 'Short text',
      fixedFontScale: 0.75,
      height: 200,
      measure,
      padding: 0,
      runs: [],
      valign: 'top',
      width: 200,
    })

    expect(layout.fontScale).toBe(0.75)
  })
})
