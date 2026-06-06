import type { ReactNode } from 'react'

import { classNames } from './classNames'
import { PatternOverlay } from './PatternOverlay'

type StudioPanelProps = {
  children: ReactNode
  className?: string
  patternClassName?: string
  withPattern?: boolean
}

export function StudioPanel({
  children,
  className,
  patternClassName,
  withPattern = true,
}: StudioPanelProps) {
  return (
    <section
      className={classNames(
        'relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b0f24] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.34)]',
        className,
      )}
    >
      {withPattern && <PatternOverlay className={patternClassName} />}
      <div className="relative">{children}</div>
    </section>
  )
}
