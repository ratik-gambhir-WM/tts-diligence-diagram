import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  importTemplate,
  listTemplates,
  type PickerTemplateKind,
  type PickerTemplateSummary,
} from '../lib/api/templateApi'
import { Button } from './Button'
import { PatternOverlay } from './PatternOverlay'

type CatalogState =
  | { status: 'error'; message: string }
  | { status: 'loading' }
  | { status: 'ready'; templates: PickerTemplateSummary[] }

type TemplatePickerProps = {
  actionContent?: ReactNode
  defaultTemplateId: string
  error?: string
  isActionPending?: boolean
  kind: PickerTemplateKind
  onSelectTemplate: (template: PickerTemplateSummary, signal: AbortSignal) => Promise<void> | void
  previewLabel: string
  relatedLabel: string
  selectLabel: string
}

const POWERPOINT_ACCEPT =
  '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'

function getWheelItemClasses(distanceFromActive: number) {
  if (distanceFromActive === 0) {
    return 'scale-110 text-[#e2b11d] opacity-100 [text-shadow:0_0_16px_rgba(226,177,29,0.45)]'
  }
  if (Math.abs(distanceFromActive) === 1) {
    return 'scale-[0.82] text-[#c8c6d5] opacity-90'
  }
  return 'scale-[0.62] text-[#e2deeb] opacity-55'
}

export function TemplatePicker({
  actionContent,
  defaultTemplateId,
  error,
  isActionPending = false,
  kind,
  onSelectTemplate,
  previewLabel,
  relatedLabel,
  selectLabel,
}: TemplatePickerProps) {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' })
  const [activeTemplateId, setActiveTemplateId] = useState(defaultTemplateId)
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(() => new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [localError, setLocalError] = useState('')
  const uploadInputId = useId()
  const mountedRef = useRef(true)
  const operationAbortRef = useRef<AbortController | null>(null)

  const loadCatalog = useCallback(async (preferredTemplateId?: string, signal?: AbortSignal) => {
    setCatalog({ status: 'loading' })
    setLocalError('')
    try {
      const result = await listTemplates(kind, signal)
      if (!mountedRef.current || signal?.aborted) return
      setCatalog({ status: 'ready', templates: result.templates })
      const preferred = preferredTemplateId ?? defaultTemplateId
      setActiveTemplateId(
        result.templates.some((template) => template.templateId === preferred)
          ? preferred
          : result.templates[0]?.templateId ?? '',
      )
    } catch (loadError) {
      if (!mountedRef.current || signal?.aborted) return
      setCatalog({
        status: 'error',
        message: loadError instanceof Error
          ? loadError.message
          : 'Templates could not be loaded. Try again.',
      })
    }
  }, [defaultTemplateId, kind])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    void loadCatalog(undefined, controller.signal)
    return () => {
      mountedRef.current = false
      controller.abort()
      operationAbortRef.current?.abort()
    }
  }, [loadCatalog])

  const templates = catalog.status === 'ready' ? catalog.templates : []
  const activeIndex = Math.max(
    0,
    templates.findIndex((template) => template.templateId === activeTemplateId),
  )
  const activeTemplate = templates[activeIndex]
  const relatedTemplates = useMemo(
    () => templates.filter((template) => template.templateId !== activeTemplate?.templateId).slice(0, 3),
    [activeTemplate?.templateId, templates],
  )
  const pending = isImporting || isSelecting || isActionPending

  function moveSelection(direction: -1 | 1) {
    if (templates.length === 0) return
    const nextIndex = (activeIndex + direction + templates.length) % templates.length
    setActiveTemplateId(templates[nextIndex]?.templateId ?? '')
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    operationAbortRef.current?.abort()
    const controller = new AbortController()
    operationAbortRef.current = controller
    setIsImporting(true)
    setImportMessage('')
    setLocalError('')
    try {
      const imported = await importTemplate(file, kind, controller.signal)
      if (!mountedRef.current || controller.signal.aborted) return
      setImportMessage(
        imported.previewStatus === 'ready'
          ? 'Template imported and selected.'
          : 'Template imported and selected. Preview rendering is unavailable on this server.',
      )
      await loadCatalog(imported.templateId, controller.signal)
    } catch (importError) {
      if (!mountedRef.current || controller.signal.aborted) return
      setLocalError(importError instanceof Error ? importError.message : 'The template could not be imported.')
    } finally {
      if (operationAbortRef.current === controller) operationAbortRef.current = null
      if (mountedRef.current && !controller.signal.aborted) setIsImporting(false)
    }
  }

  async function handleSelect() {
    if (!activeTemplate || pending) return
    operationAbortRef.current?.abort()
    const controller = new AbortController()
    operationAbortRef.current = controller
    setIsSelecting(true)
    setLocalError('')
    try {
      await onSelectTemplate(activeTemplate, controller.signal)
    } catch (selectionError) {
      if (mountedRef.current && !controller.signal.aborted) {
        setLocalError(selectionError instanceof Error ? selectionError.message : 'The template could not be opened.')
      }
    } finally {
      if (operationAbortRef.current === controller) operationAbortRef.current = null
      if (mountedRef.current && !controller.signal.aborted) setIsSelecting(false)
    }
  }

  return (
    <section className="mx-auto grid min-h-0 w-full max-w-[1340px] flex-1 grid-cols-[0.92fr_1.08fr] items-center gap-10 pt-10 max-[980px]:grid-cols-1 max-[980px]:gap-8">
      <div className="relative flex min-h-[620px] items-center justify-center overflow-visible px-12 max-[980px]:min-h-[380px] max-[980px]:px-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="h-[430px] w-[430px] rounded-full border border-white/10" />
          <div className="absolute h-[510px] w-[510px] rounded-full border border-white/6" />
        </div>

        {catalog.status === 'loading' && (
          <p className="relative z-10 text-sm font-bold tracking-[0.12em] text-[#c8c6d5] uppercase" role="status">
            Loading templates…
          </p>
        )}
        {catalog.status === 'error' && (
          <div className="relative z-10 max-w-sm text-center">
            <p className="text-[#ffb5b5]" role="alert">{catalog.message}</p>
            <Button type="button" variant="secondary" className="mt-5" onClick={() => void loadCatalog()}>
              Retry
            </Button>
          </div>
        )}
        {catalog.status === 'ready' && templates.length === 0 && (
          <div className="relative z-10 max-w-sm text-center">
            <p className="text-xl font-bold text-white">No {kind} templates yet</p>
            <p className="mt-3 text-[#a8afc4]">Import a one-slide PowerPoint to start this catalog.</p>
          </div>
        )}
        {activeTemplate && (
          <>
            <button
              type="button"
              onClick={() => moveSelection(-1)}
              aria-label={`${kind} template above`}
              disabled={pending}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-md border-0 bg-transparent px-3 py-2 text-[3rem] leading-none text-[#e2b11d] transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3c316] disabled:opacity-40"
            >
              &lsaquo;
            </button>
            <div className="relative z-10 flex w-full max-w-[560px] flex-col items-center gap-9 px-8">
              {templates.map((template, index) => (
                <button
                  key={template.templateId}
                  type="button"
                  onClick={() => setActiveTemplateId(template.templateId)}
                  disabled={pending}
                  aria-current={template.templateId === activeTemplate.templateId ? 'true' : undefined}
                  className={`cursor-pointer rounded-md border-0 bg-transparent px-3 py-2 text-center text-[clamp(1rem,2vw,1.48rem)] font-bold uppercase tracking-[0.14em] transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3c316] disabled:cursor-wait ${getWheelItemClasses(index - activeIndex)}`}
                >
                  {template.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => moveSelection(1)}
              aria-label={`${kind} template below`}
              disabled={pending}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-md border-0 bg-transparent px-3 py-2 text-[3rem] leading-none text-[#e2b11d] transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3c316] disabled:opacity-40"
            >
              &rsaquo;
            </button>
          </>
        )}
      </div>

      <div className="relative overflow-hidden rounded-[1rem] bg-[#0b0f24] px-8 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.34)] ring-1 ring-white/12 max-[640px]:px-5">
        <PatternOverlay className="opacity-35" />
        {activeTemplate ? (
          <>
            <div className="relative overflow-hidden rounded-[0.75rem] bg-[#080c1c] p-4 ring-1 ring-[#28304a]">
              {activeTemplate.previewUrl && !failedPreviews.has(activeTemplate.templateId) ? (
                <img
                  src={activeTemplate.previewUrl}
                  alt={`${activeTemplate.title} template preview`}
                  onError={() => setFailedPreviews((current) => new Set(current).add(activeTemplate.templateId))}
                  className="block aspect-[18/10] w-full object-contain object-center"
                />
              ) : (
                <div className="grid aspect-[18/10] place-items-center bg-[#0d132b] text-center">
                  <div>
                    <svg className="mx-auto h-10 w-10 text-[#f3c316]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M4 4h16v16H4zM7 15l3-3 2 2 2-2 3 3" />
                    </svg>
                    <p className="mt-3 text-sm font-bold tracking-[0.1em] text-[#c8c6d5] uppercase">Preview unavailable</p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative mt-7">
              <div className="flex items-center gap-3">
                <div className="h-1 w-12 bg-[#f3c316]" />
                <span className="text-[0.82rem] font-bold uppercase tracking-[0.12em] text-[#f3c316]">{previewLabel}</span>
              </div>
              <h1 className="mt-5 text-[clamp(2.5rem,6vw,4.2rem)] leading-[0.94] tracking-[0.01em] text-white">{activeTemplate.title}</h1>
              <p className="mt-5 max-w-[38rem] text-[1rem] leading-[1.65] text-[#a8afc4]">{activeTemplate.description}</p>
              <p className="mt-3 text-xs font-bold tracking-[0.1em] text-[#7f89a4] uppercase">
                {activeTemplate.slideCount} slide · {activeTemplate.elementCount} elements
              </p>
            </div>

            <div className="relative mt-8 border-t border-white/12 pt-7">
              <p className="mb-3 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-[#8d93aa]">{relatedLabel}</p>
              <div className="flex flex-wrap gap-3">
                {relatedTemplates.map((template) => (
                  <button
                    key={template.templateId}
                    type="button"
                    onClick={() => setActiveTemplateId(template.templateId)}
                    disabled={pending}
                    className="group h-14 w-24 cursor-pointer overflow-hidden rounded-md bg-[#080c1c] p-0 ring-1 ring-[#28304a] transition hover:ring-[#f3c316] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3c316] disabled:opacity-50"
                    aria-label={`Preview ${template.title}`}
                  >
                    {template.previewUrl && !failedPreviews.has(template.templateId) ? (
                      <img src={template.previewUrl} alt="" onError={() => setFailedPreviews((current) => new Set(current).add(template.templateId))} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <span className="grid h-full place-items-center px-2 text-[0.62rem] font-bold text-[#a8afc4] uppercase">No preview</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="relative grid min-h-[340px] place-items-center text-center text-[#a8afc4]">
            <p>{catalog.status === 'loading' ? 'Connecting to the template catalog…' : 'Import a PowerPoint template to continue.'}</p>
          </div>
        )}

        <div className="relative mt-8 grid gap-5 border-t border-white/12 pt-7">
          <div className="flex flex-wrap items-center gap-3 rounded-[0.75rem] bg-[#080c1c] px-4 py-4 ring-1 ring-[#28304a]">
            <svg className="h-6 w-6 shrink-0 text-[#f3c316]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" />
            </svg>
            <div className="min-w-[12rem] flex-1">
              <p className="font-bold text-white">Import a template</p>
              <p className="mt-1 text-sm text-[#a8afc4]">Upload a one-slide .pptx file to add it to this catalog.</p>
            </div>
            <label htmlFor={uploadInputId} className="cursor-pointer rounded-md bg-[#eef3ff] px-4 py-2 text-sm font-bold text-[#070a1b] transition hover:bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f3c316] has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
              {isImporting ? 'Importing…' : 'Choose PowerPoint'}
              <input
                id={uploadInputId}
                type="file"
                accept={POWERPOINT_ACCEPT}
                disabled={pending}
                className="sr-only"
                onChange={(event) => {
                  void handleImport(event.currentTarget.files?.[0])
                  event.currentTarget.value = ''
                }}
              />
            </label>
          </div>

          {actionContent}
          <Button type="button" onClick={() => void handleSelect()} disabled={!activeTemplate || pending} variant="secondary" className="w-fit px-12 py-4 text-[1rem]">
            {isSelecting || isActionPending ? 'Loading template…' : selectLabel}
          </Button>
          {(localError || error) && <p className="text-[0.92rem] text-[#ffb5b5]" role="alert">{localError || error}</p>}
          {importMessage && !localError && <p className="text-[0.92rem] text-[#c7f7d8]" role="status">{importMessage}</p>}
        </div>
      </div>
    </section>
  )
}
