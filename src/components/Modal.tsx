import type { ReactNode } from 'react'

import { Button } from './Button'

type ModalProps = {
  children: ReactNode
  labelledBy: string
  onClose: () => void
  title: string
}

export function Modal({ children, labelledBy, onClose, title }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#070a1b]/80 px-6 py-8 backdrop-blur-sm">
      <div
        aria-labelledby={labelledBy}
        aria-modal="true"
        className="w-full max-w-[560px] rounded-[1.5rem] border border-white/12 bg-[#0b0f24] p-6 text-[#eef3ff] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={labelledBy} className="text-xl font-bold text-white">
            {title}
          </h2>
          <Button
            type="button"
            variant="secondary"
            className="rounded-full px-4 py-2 text-[0.78rem] tracking-normal"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
