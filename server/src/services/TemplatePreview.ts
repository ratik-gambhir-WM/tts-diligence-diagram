import { execFile } from 'node:child_process'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

import type { PowerPointCanvasJson } from '../lib/import/PowerpointImportTypes'

export type GeneratedTemplatePreview = {
  bytes: Buffer
  contentType: 'image/png'
  height: number
  width: number
}

export interface TemplatePreviewGenerator {
  /** Whether the generator can render any supplied one-slide JSON independently. */
  readonly supportsIndependentSlides?: boolean
  generate(
    request: TemplatePreviewRequest,
    signal?: AbortSignal,
  ): Promise<GeneratedTemplatePreview | undefined>
}

export type TemplatePreviewRequest = {
  inputPath: string
  outputDirectory: string
  templateJson: PowerPointCanvasJson
}

type QuickLookPreviewOptions = {
  maxBytes: number
  maxDimension?: number
  renderSize: number
  timeoutMs: number
}

export type QuickLookProcessRunner = (
  inputPath: string,
  outputDirectory: string,
  options: QuickLookPreviewOptions,
  signal?: AbortSignal,
) => Promise<void>

type HeadlessPreviewOptions = {
  maxBytes: number
  maxDimension?: number
  renderSize: number
  renderUrl: string
  timeoutMs: number
}

export type HeadlessPreviewRunner = (
  templateJson: PowerPointCanvasJson,
  options: HeadlessPreviewOptions,
  signal?: AbortSignal,
) => Promise<Buffer>

export class DisabledTemplatePreviewGenerator implements TemplatePreviewGenerator {
  async generate() {
    return undefined
  }
}

export class QuickLookTemplatePreviewGenerator implements TemplatePreviewGenerator {
  readonly supportsIndependentSlides = false

  constructor(
    private readonly options: QuickLookPreviewOptions,
    private readonly processRunner: QuickLookProcessRunner = runQuickLook,
  ) {}

  async generate(request: TemplatePreviewRequest, signal?: AbortSignal) {
    try {
      await this.processRunner(request.inputPath, request.outputDirectory, this.options, signal)
      const entries = await readdir(request.outputDirectory)
      if (entries.length !== 1 || !entries[0]?.toLowerCase().endsWith('.png')) {
        return undefined
      }

      const previewPath = path.join(request.outputDirectory, entries[0])
      const stats = await lstat(previewPath)
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > this.options.maxBytes) {
        return undefined
      }

      const bytes = await readFile(previewPath)
      const dimensions = readPngDimensions(bytes)
      const maxDimension = this.options.maxDimension ?? Math.max(this.options.renderSize * 2, 4096)
      if (
        !dimensions
        || bytes.length > this.options.maxBytes
        || dimensions.width > maxDimension
        || dimensions.height > maxDimension
      ) {
        return undefined
      }

      return { bytes, contentType: 'image/png' as const, ...dimensions }
    } catch {
      return undefined
    }
  }
}

export class HeadlessTemplatePreviewGenerator implements TemplatePreviewGenerator {
  readonly supportsIndependentSlides = true
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly options: HeadlessPreviewOptions,
    private readonly runner: HeadlessPreviewRunner = runHeadlessPreview,
  ) {}

  generate(request: TemplatePreviewRequest, signal?: AbortSignal) {
    const operation = this.queue.then(() => this.generatePreview(request, signal))
    this.queue = operation.then(() => undefined, () => undefined)
    return operation
  }

  private async generatePreview(request: TemplatePreviewRequest, signal?: AbortSignal) {
    try {
      const bytes = await this.runner(request.templateJson, this.options, signal)
      const dimensions = readPngDimensions(bytes)
      const maxDimension = this.options.maxDimension ?? Math.max(this.options.renderSize * 2, 4096)
      if (
        !dimensions
        || bytes.length > this.options.maxBytes
        || dimensions.width > maxDimension
        || dimensions.height > maxDimension
      ) {
        return undefined
      }

      return { bytes, contentType: 'image/png' as const, ...dimensions }
    } catch {
      return undefined
    }
  }
}

export function readPngDimensions(bytes: Buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (
    bytes.length < 24
    || !bytes.subarray(0, signature.length).equals(signature)
    || bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return undefined
  }

  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  return width > 0 && height > 0 ? { height, width } : undefined
}

function runQuickLook(
  inputPath: string,
  outputDirectory: string,
  options: QuickLookPreviewOptions,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    execFile(
      '/usr/bin/qlmanage',
      ['-t', '-s', String(options.renderSize), '-o', outputDirectory, inputPath],
      {
        encoding: 'utf8',
        maxBuffer: 32 * 1024,
        signal,
        timeout: options.timeoutMs,
      },
      (error) => error ? reject(error) : resolve(),
    )
  })
}

async function runHeadlessPreview(
  templateJson: PowerPointCanvasJson,
  options: HeadlessPreviewOptions,
  signal?: AbortSignal,
) {
  if (signal?.aborted) {
    throw new Error('Template preview rendering was cancelled.')
  }

  const browser = await chromium.launch({ chromiumSandbox: true, headless: true })
  const closeBrowser = () => {
    void browser.close()
  }
  signal?.addEventListener('abort', closeBrowser, { once: true })

  try {
    const renderUrl = new URL(options.renderUrl)
    renderUrl.searchParams.set('maxDimension', String(options.renderSize))
    const allowedOrigin = renderUrl.origin
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { height: options.renderSize, width: options.renderSize },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(options.timeoutMs)
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url())
      if (
        requestUrl.origin === allowedOrigin
        || requestUrl.protocol === 'blob:'
        || requestUrl.protocol === 'data:'
      ) {
        await route.continue()
      } else {
        await route.abort('blockedbyclient')
      }
    })
    await page.addInitScript((input) => {
      Object.defineProperty(window, '__TTS_MERMAID_TEMPLATE_PREVIEW_INPUT__', {
        configurable: true,
        value: input,
      })
    }, templateJson)
    await page.goto(renderUrl.toString(), {
      timeout: options.timeoutMs,
      waitUntil: 'domcontentloaded',
    })

    const state = page.locator('[data-preview-state]')
    await state.waitFor({ state: 'attached', timeout: options.timeoutMs })
    if (await state.getAttribute('data-preview-state') !== 'ready') {
      throw new Error('The template preview page could not render the slide.')
    }

    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })
    return await page.locator('[data-template-preview-surface]').screenshot({
      animations: 'disabled',
      type: 'png',
    })
  } finally {
    signal?.removeEventListener('abort', closeBrowser)
    await browser.close()
  }
}
