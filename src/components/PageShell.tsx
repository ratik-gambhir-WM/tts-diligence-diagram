import type { ReactNode } from 'react'

import { classNames } from './classNames'

type PageShellProps = {
  children: ReactNode
  className?: string
  layout?: 'center' | 'workspace'
}

export function PageShell({ children, className, layout = 'workspace' }: PageShellProps) {
  return (
    <main
      className={classNames(
        'page-shell',
        layout === 'center' ? 'page-shell-center' : 'page-shell-workspace',
        className,
      )}
    >
      {children}
    </main>
  )
}
