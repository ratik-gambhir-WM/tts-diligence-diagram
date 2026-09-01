import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  disconnect() {}
  unobserve() {}
  observe(target: Element) {
    this.callback(
      [
        {
          borderBoxSize: [],
          contentBoxSize: [],
          contentRect: target.getBoundingClientRect(),
          devicePixelContentBoxSize: [],
          target,
        },
      ],
      this as unknown as ResizeObserver,
    )
  }
}

class DOMPointMock {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  matrixTransform(matrix: DOMMatrix) {
    return new DOMPointMock(
      this.x * matrix.a + this.y * matrix.c + matrix.e,
      this.x * matrix.b + this.y * matrix.d + matrix.f,
    )
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
})
Object.defineProperty(globalThis, 'DOMPoint', {
  configurable: true,
  value: DOMPointMock,
})
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: vi.fn(() => ({
    font: '',
    measureText: (text: string) => ({ width: text.length * 9 }),
  })),
})

Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
  configurable: true,
  value: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse() {
      return this
    },
  })),
})
Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
  configurable: true,
  value: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse() {
      return this
    },
  })),
})
Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
  configurable: true,
  value: vi.fn(),
})
Object.defineProperty(SVGSVGElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: vi.fn(() => true),
})
Object.defineProperty(SVGSVGElement.prototype, 'releasePointerCapture', {
  configurable: true,
  value: vi.fn(),
})
