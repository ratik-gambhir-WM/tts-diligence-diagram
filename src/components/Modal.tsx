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
    <div className="modal-backdrop">
      <div
        aria-labelledby={labelledBy}
        aria-modal="true"
        className="modal-panel"
        role="dialog"
      >
        <div className="modal-header">
          <h2 id={labelledBy} className="modal-title">
            {title}
          </h2>
          <Button
            type="button"
            variant="secondary"
            className="modal-close-button"
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
