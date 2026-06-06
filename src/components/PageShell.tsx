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
        layout === 'center'
          ? 'grid min-h-screen place-items-center bg-[#070a1b] px-6 py-8 text-[#eef3ff]'
          : 'flex min-h-screen flex-col bg-[#070a1b] p-8 text-[#eef3ff] max-[640px]:p-4',
        className,
      )}
    >
      {children}
    </main>
  )
}
