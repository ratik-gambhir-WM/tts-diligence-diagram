import { describe, expect, it } from 'vitest'

import { getWestMonroeBrandFrameLayout } from './WestMonroeBrandFrame'

describe('getWestMonroeBrandFrameLayout', () => {
  it('matches the reference West Monroe slide frame', () => {
    const frame = getWestMonroeBrandFrameLayout(1280, 720)

    expect(frame.footer).toEqual({ x: 0, y: 645, w: 1280, h: 75 })
    expect(frame.logo).toEqual({ x: 48.33, y: 664.08, w: 153, h: 32.02 })
    expect(frame.dots).toHaveLength(255)
    expect(frame.dots.at(-1)).toEqual({ x: 281, y: 310, w: 2.5, h: 2.5 })
  })

  it('scales the frame with non-standard slide dimensions', () => {
    const frame = getWestMonroeBrandFrameLayout(640, 360)

    expect(frame.footer).toEqual({ x: 0, y: 322.5, w: 640, h: 37.5 })
    expect(frame.logo).toEqual({ x: 24.165, y: 332.04, w: 76.5, h: 16.01 })
  })
})
