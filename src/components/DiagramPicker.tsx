import { useId, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'

import {
  DEFAULT_DIAGRAM_TEMPLATE_ID,
  DIAGRAM_TEMPLATES,
} from '../lib/diagramTemplates'
import type { DiagramTemplate } from '../lib/diagramTemplates'
import { SnailLoader } from './SnailLoader'

type DiagramPickerProps = {
  acceptAttr: string
  attachmentCountLabel: string
  attachments: File[]
  error: string
  isSubmitting: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenInputPage: () => void
  onRemoveAttachment: (index: number) => void
  onSelectTemplate: (template: DiagramTemplate) => void
  renderFileSize: (bytes: number) => string
}

function getWheelItemClasses(distanceFromActive: number) {
  if (distanceFromActive === 0) {
    return 'scale-110 text-[#e2b11d] opacity-100 [text-shadow:0_0_16px_rgba(226,177,29,0.45)]'
  }

  if (Math.abs(distanceFromActive) === 1) {
    return 'scale-[0.82] text-[#c8c6d5] opacity-90'
  }

  return 'scale-[0.62] text-[#e2deeb] opacity-55'
}

export function DiagramPicker({
  acceptAttr,
  attachmentCountLabel,
  attachments,
  error,
  isSubmitting,
  onFileChange,
  onOpenInputPage,
  onRemoveAttachment,
  onSelectTemplate,
  renderFileSize,
}: DiagramPickerProps) {
  const [activeIndex, setActiveIndex] = useState(() => {
    const defaultIndex = DIAGRAM_TEMPLATES.findIndex(
      (template) => template.id === DEFAULT_DIAGRAM_TEMPLATE_ID,
    )

    return defaultIndex >= 0 ? defaultIndex : 0
  })
  const inputId = useId()

  const activeTemplate = DIAGRAM_TEMPLATES[activeIndex]
  const relatedTemplates = useMemo(
    () => DIAGRAM_TEMPLATES.filter((_, index) => index !== activeIndex).slice(0, 3),
    [activeIndex],
  )

  if (isSubmitting) {
    return <SnailLoader />
  }

  function moveSelection(direction: 'above' | 'below') {
    setActiveIndex((currentIndex) => {
      if (direction === 'above') {
        return currentIndex === 0 ? DIAGRAM_TEMPLATES.length - 1 : currentIndex - 1
      }

      return currentIndex === DIAGRAM_TEMPLATES.length - 1 ? 0 : currentIndex + 1
    })
  }

  return (
    <main className="min-h-screen bg-[#f6f3ff] text-[#17164d]">
      <header className="sticky top-0 z-20 border-b border-[#d8d4e9] bg-[#f9f7ff]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-8 py-5 max-[900px]:px-5">
          <div className="text-[clamp(1.75rem,3vw,2.4rem)] font-bold tracking-[0.08em]">Diagram Picker</div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenInputPage}
              className="cursor-pointer rounded-none border border-[#17164d] bg-transparent px-5 py-2 text-[0.94rem] font-bold tracking-[0.12em] uppercase transition hover:bg-[#17164d] hover:text-white"
            >
              Input Page
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-89px)] max-w-[1340px] grid-cols-[0.95fr_1.05fr] items-center gap-10 px-8 py-10 max-[980px]:grid-cols-1 max-[980px]:gap-12 max-[980px]:px-5">
        <div className="relative flex min-h-[620px] items-center justify-center overflow-visible px-12 max-[980px]:min-h-[420px] max-[980px]:px-8">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[430px] w-[430px] rounded-full border border-[#ddd7ee]" />
            <div className="absolute h-[510px] w-[510px] rounded-full border border-[#ebe5f5]" />
          </div>

          <button
            type="button"
            onClick={() => moveSelection('above')}
            aria-label="Diagram above"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-3 py-2 text-[3rem] leading-none text-[#e2b11d] transition hover:scale-110"
          >
            ‹
          </button>

          <div className="relative z-10 flex w-full max-w-[560px] flex-col items-center gap-11 px-8">
            {DIAGRAM_TEMPLATES.map((template, index) => {
              const distanceFromActive = index - activeIndex

              return (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`cursor-pointer border-0 bg-transparent text-center text-[clamp(1rem,2vw,1.48rem)] font-bold uppercase tracking-[0.16em] transition duration-300 ${getWheelItemClasses(distanceFromActive)}`}
                >
                  {template.name}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => moveSelection('below')}
            aria-label="Diagram below"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-3 py-2 text-[3rem] leading-none text-[#e2b11d] transition hover:scale-110"
          >
            ›
          </button>
        </div>

        <div className="border border-[#ece7f5] bg-white px-8 py-8 shadow-[0_22px_50px_rgba(80,52,160,0.12)] max-[640px]:px-5">
          <div className="relative overflow-hidden border border-[#dfe3f3] bg-[#eef2fb] p-4">
            <img
              src={activeTemplate.image}
              alt={activeTemplate.relatedAlt}
              className="block aspect-[18/10] w-full object-contain object-center"
            />
          </div>

          <div className="mt-7">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-[#7f1be8]" />
              <span className="text-[0.82rem] uppercase tracking-[0.09em] text-[#7f1be8]">Selection Preview</span>
            </div>

            <h1 className="mt-5 text-[clamp(2.8rem,6vw,4.5rem)] leading-[0.94] tracking-[0.03em]">
              {activeTemplate.name}
            </h1>
            <p className="mt-5 max-w-[38rem] font-sans text-[1.14rem] leading-[1.65] text-[#4e4c6b]">
              {activeTemplate.description}
            </p>
          </div>

          <div className="mt-8 border-t border-[#e7e1f0] pt-7">
            <p className="mb-3 text-[0.82rem] uppercase tracking-[0.09em] text-[#6b6885]">Related Diagrams</p>
            <div className="flex flex-wrap gap-3">
              {relatedTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() =>
                    setActiveIndex(DIAGRAM_TEMPLATES.findIndex((item) => item.name === template.name))
                  }
                  className="group h-14 w-24 cursor-pointer overflow-hidden border border-[#ddd8ea] bg-[#f7f4fd] p-0 transition hover:border-[#7f1be8]"
                >
                  <img
                    src={template.image}
                    alt={template.relatedAlt}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center justify-center bg-[#f3c316] px-12 py-4 text-[1.05rem] font-bold uppercase tracking-[0.12em] text-[#17164d] transition hover:brightness-105"
            >
              Add Context Files
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept={acceptAttr}
              onChange={onFileChange}
              disabled={isSubmitting}
              className="sr-only"
            />
            <p className="mt-3 font-sans text-[0.98rem] text-[#5c5974]">
              {attachmentCountLabel}
            </p>
            <button
              type="button"
              onClick={() => onSelectTemplate(activeTemplate)}
              disabled={isSubmitting}
              className="mt-5 inline-flex items-center justify-center bg-[#17164d] px-12 py-4 text-[1.05rem] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Generating...' : 'Submit'}
            </button>
            {error && <p className="mt-3 font-sans text-[0.98rem] text-red-700">{error}</p>}
          </div>

          {attachments.length > 0 && (
            <ul className="mt-5 grid list-none gap-2 p-0" aria-label="Diagram context files">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between gap-3 border border-[#e4deef] bg-[#faf8ff] px-3 py-3"
                >
                  <span className="min-w-0 flex-1 truncate font-sans text-[0.95rem] text-[#403d60]">
                    {file.name} ({renderFileSize(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(index)}
                    disabled={isSubmitting}
                    className="cursor-pointer border-0 bg-transparent text-[0.88rem] font-bold uppercase tracking-[0.08em] text-[#17164d] transition hover:text-[#7f1be8]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}
