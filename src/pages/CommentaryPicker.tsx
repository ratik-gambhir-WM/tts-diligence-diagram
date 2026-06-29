import { useMemo, useState } from 'react'

import { AppNav } from '../components/AppNav'
import { Button } from '../components/Button'
import { PageShell } from '../components/PageShell'
import { PatternOverlay } from '../components/PatternOverlay'
import {
  COMMENTARY_TEMPLATES,
  DEFAULT_COMMENTARY_TEMPLATE_ID,
  type CommentaryTemplate,
} from '../lib/commentaryTemplates'

type CommentaryPickerProps = {
  onOpenInputPage: () => void
  onOpenJsonInput: () => void
  onSelectTemplate: (template: CommentaryTemplate) => void
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

export function CommentaryPicker({
  onOpenInputPage,
  onOpenJsonInput,
  onSelectTemplate,
}: CommentaryPickerProps) {
  const [activeIndex, setActiveIndex] = useState(() => {
    const defaultIndex = COMMENTARY_TEMPLATES.findIndex(
      (template) => template.id === DEFAULT_COMMENTARY_TEMPLATE_ID,
    )

    return defaultIndex >= 0 ? defaultIndex : 0
  })

  const activeTemplate = COMMENTARY_TEMPLATES[activeIndex]
  const relatedTemplates = useMemo(
    () => COMMENTARY_TEMPLATES.filter((_, index) => index !== activeIndex).slice(0, 3),
    [activeIndex],
  )

  function moveSelection(direction: 'above' | 'below') {
    setActiveIndex((currentIndex) => {
      if (direction === 'above') {
        return currentIndex === 0 ? COMMENTARY_TEMPLATES.length - 1 : currentIndex - 1
      }

      return currentIndex === COMMENTARY_TEMPLATES.length - 1 ? 0 : currentIndex + 1
    })
  }

  return (
    <PageShell>
      <AppNav
        activePage="commentary"
        onOpenInputPage={onOpenInputPage}
        onOpenJsonInput={onOpenJsonInput}
      />

      <section className="mx-auto grid min-h-0 w-full max-w-[1340px] flex-1 grid-cols-[0.95fr_1.05fr] items-center gap-10 pt-10 max-[980px]:grid-cols-1 max-[980px]:gap-12">
        <div className="relative flex min-h-[620px] items-center justify-center overflow-visible px-12 max-[980px]:min-h-[420px] max-[980px]:px-8">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[430px] w-[430px] rounded-full border border-white/10" />
            <div className="absolute h-[510px] w-[510px] rounded-full border border-white/6" />
          </div>

          <button
            type="button"
            onClick={() => moveSelection('above')}
            aria-label="Commentary slide above"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-3 py-2 text-[3rem] leading-none text-[#e2b11d] transition hover:scale-110"
          >
            &lsaquo;
          </button>

          <div className="relative z-10 flex w-full max-w-[560px] flex-col items-center gap-11 px-8">
            {COMMENTARY_TEMPLATES.map((template, index) => {
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
            aria-label="Commentary slide below"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-3 py-2 text-[3rem] leading-none text-[#e2b11d] transition hover:scale-110"
          >
            &rsaquo;
          </button>
        </div>

        <div className="relative overflow-hidden border border-white/12 bg-[#0b0f24] px-8 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.34)] max-[640px]:px-5">
          <PatternOverlay className="opacity-35" />

          <div className="relative overflow-hidden border border-[#28304a] bg-[#080c1c] p-4">
            <img
              src={activeTemplate.image}
              alt={activeTemplate.relatedAlt}
              className="block aspect-[18/10] w-full object-contain object-center"
            />
          </div>

          <div className="relative mt-7">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-[#f3c316]" />
              <span className="text-[0.82rem] font-bold uppercase tracking-[0.12em] text-[#f3c316]">
                Commentary Preview
              </span>
            </div>

            <h1 className="mt-5 text-[clamp(2.5rem,6vw,4.2rem)] leading-[0.94] tracking-[0.03em] text-white">
              {activeTemplate.name}
            </h1>
            <p className="mt-5 max-w-[38rem] text-[1rem] leading-[1.65] text-[#a8afc4]">
              {activeTemplate.description}
            </p>
          </div>

          <div className="relative mt-8 border-t border-white/12 pt-7">
            <p className="mb-3 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-[#8d93aa]">
              Related Commentary
            </p>
            <div className="flex flex-wrap gap-3">
              {relatedTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() =>
                    setActiveIndex(
                      COMMENTARY_TEMPLATES.findIndex((item) => item.name === template.name),
                    )
                  }
                  className="group h-14 w-24 cursor-pointer overflow-hidden border border-[#28304a] bg-[#080c1c] p-0 transition hover:border-[#f3c316]"
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

          <div className="relative mt-10">
            <Button
              type="button"
              onClick={() => onSelectTemplate(activeTemplate)}
              variant="secondary"
              className="inline-flex items-center justify-center px-12 py-4 text-[1rem]"
            >
              Generate Slide
            </Button>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
