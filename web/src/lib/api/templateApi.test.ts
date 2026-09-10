import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deleteTemplate,
  getTemplate,
  importTemplate,
  listTemplates,
  TemplateApiError,
} from './templateApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('template API client', () => {
  it('validates and resolves the catalog preview URLs under the API base', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      templates: [{
        templateId: 'template-1',
        kind: 'diagram',
        title: 'Template one',
        description: 'Description',
        slideCount: 1,
        elementCount: 3,
        previewUrl: '/templates/template-1/preview',
      }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listTemplates('diagram')).resolves.toEqual({
      templates: [expect.objectContaining({
        previewUrl: '/api/templates/template-1/preview',
        templateId: 'template-1',
      })],
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/templates?kind=diagram', { signal: undefined })
  })

  it('rejects malformed catalog and canvas responses', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ templates: [{ templateId: 4 }] }))
      .mockResolvedValueOnce(jsonResponse({ presentation: { slides: [] } })))

    await expect(listTemplates('diagram')).rejects.toBeInstanceOf(TemplateApiError)
    await expect(getTemplate('template-1')).rejects.toMatchObject({ code: 'invalid_api_response' })
  })

  it('returns the imported template ID and preview status from headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { presentation: { slides: [{}] } },
      {
        status: 201,
        headers: {
          'X-Template-Id': 'imported-template',
          'X-Template-Preview-Status': 'ready',
        },
      },
    )))
    const file = new File(['pptx'], 'template.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })

    await expect(importTemplate(file, 'commentary')).resolves.toMatchObject({
      previewStatus: 'ready',
      templateId: 'imported-template',
    })
  })

  it('deletes an encoded template ID and requires the 204 response contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteTemplate('template/one')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/templates/template%2Fone', {
      method: 'DELETE',
      signal: undefined,
    })
    await expect(deleteTemplate('template-two')).rejects.toMatchObject({
      code: 'invalid_api_response',
    })
  })
})

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { ...init, headers })
}
