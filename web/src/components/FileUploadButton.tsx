import type { ChangeEvent, ReactNode } from 'react'

import { classNames } from './classNames'

type FileUploadButtonProps = {
  accept: string
  children: ReactNode
  className?: string
  disabled?: boolean
  id: string
  multiple?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  variant?: 'primary' | 'secondary'
}

export function FileUploadButton({
  accept,
  children,
  className,
  disabled = false,
  id,
  multiple = true,
  onChange,
  variant = 'primary',
}: FileUploadButtonProps) {
  return (
    <>
      <label
        htmlFor={id}
        aria-disabled={disabled}
        className={classNames(
          'file-upload-button',
          variant === 'primary' ? 'file-upload-button-primary' : 'file-upload-button-secondary',
          disabled && 'file-upload-button-disabled',
          className,
        )}
      >
        {children}
      </label>
      <input
        id={id}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
    </>
  )
}
