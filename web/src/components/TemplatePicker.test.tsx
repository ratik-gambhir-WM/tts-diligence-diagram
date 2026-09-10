import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TemplatePicker } from './TemplatePicker'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('TemplatePicker', () => {
  it('loads the API catalog and selects by stable template ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      templates: [
        summary('first-template', 'First template'),
        summary('second-template', 'Second template'),
      ],
    })))
    const onSelect = vi.fn(async () => undefined)
    render(
      <TemplatePicker
        kind="diagram"
        defaultTemplateId="first-template"
        previewLabel="Selection Preview"
        relatedLabel="Related Diagrams"
        selectLabel="Generate Slide"
        onSelectTemplate={onSelect}
      />,
    )

    await screen.findByRole('heading', { name: 'First template' })
    await userEvent.click(screen.getByRole('button', { name: 'Second template' }))
    await userEvent.click(screen.getByRole('button', { name: 'Generate Slide' }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'second-template' }),
      expect.any(AbortSignal),
    )
  })

  it('imports a PowerPoint, refreshes the catalog, and selects the new template', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ templates: [summary('first-template', 'First template')] }))
      .mockResolvedValueOnce(jsonResponse(
        { presentation: { slides: [{}] } },
        {
          status: 201,
          headers: {
            'X-Template-Id': 'imported-template',
            'X-Template-Preview-Status': 'unavailable',
          },
        },
      ))
      .mockResolvedValueOnce(jsonResponse({ templates: [
        summary('imported-template', 'Imported template', null),
        summary('first-template', 'First template'),
      ] }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <TemplatePicker
        kind="diagram"
        defaultTemplateId="first-template"
        previewLabel="Selection Preview"
        relatedLabel="Related Diagrams"
        selectLabel="Generate Slide"
        onSelectTemplate={() => undefined}
      />,
    )

    await screen.findByRole('heading', { name: 'First template' })
    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('Expected a file input.')
    fireEvent.change(input, {
      target: { files: [new File(['pptx'], 'template.pptx')] },
    })

    await screen.findByRole('heading', { name: 'Imported template' })
    expect(screen.getByRole('status').textContent).toContain('Preview rendering is unavailable')
  })

  it('deletes the active template and selects the next available template', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ templates: [
        summary('first-template', 'First template'),
        summary('second-template', 'Second template'),
      ] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ templates: [
        summary('second-template', 'Second template'),
      ] }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <TemplatePicker
        kind="diagram"
        defaultTemplateId="first-template"
        previewLabel="Selection Preview"
        relatedLabel="Related Diagrams"
        selectLabel="Generate Slide"
        onSelectTemplate={() => undefined}
      />,
    )

    await screen.findByRole('heading', { name: 'First template' })
    await userEvent.click(screen.getByRole('button', { name: 'Delete First template' }))

    await screen.findByRole('heading', { name: 'Second template' })
    expect(window.confirm).toHaveBeenCalledWith(
      'Delete “First template”? This cannot be undone.',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/templates/first-template', {
      method: 'DELETE',
      signal: expect.any(AbortSignal),
    })
    expect(screen.getByRole('status').textContent).toContain('First template deleted.')
  })

  it('keeps the template selected and shows the server error when deletion fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        templates: [summary('first-template', 'First template')],
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: { code: 'delete_failed', message: 'The template could not be deleted.' },
      }, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <TemplatePicker
        kind="diagram"
        defaultTemplateId="first-template"
        previewLabel="Selection Preview"
        relatedLabel="Related Diagrams"
        selectLabel="Generate Slide"
        onSelectTemplate={() => undefined}
      />,
    )

    await screen.findByRole('heading', { name: 'First template' })
    await userEvent.click(screen.getByRole('button', { name: 'Delete First template' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The template could not be deleted.',
    )
    expect(screen.getByRole('heading', { name: 'First template' })).not.toBeNull()
    const deleteButton = screen.getByRole('button', { name: 'Delete First template' })
    expect(deleteButton).toBeInstanceOf(HTMLButtonElement)
    expect((deleteButton as HTMLButtonElement).disabled).toBe(false)
  })
})

function summary(
  templateId: string,
  title: string,
  previewUrl: string | null = `/templates/${templateId}/preview`,
) {
  return {
    description: `${title} description`,
    elementCount: 2,
    kind: 'diagram',
    previewUrl,
    slideCount: 1,
    templateId,
    title,
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { ...init, headers })
}
