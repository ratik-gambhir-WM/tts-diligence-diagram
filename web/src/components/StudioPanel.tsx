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
        'studio-panel',
        className,
      )}
    >
      {withPattern && <PatternOverlay className={patternClassName} />}
      <div className="studio-panel-content">{children}</div>
    </section>
  )
}
