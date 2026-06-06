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
          'inline-flex cursor-pointer items-center justify-center font-bold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed',
          variant === 'primary'
            ? 'border border-[#f3c316] bg-[#f3c316] text-[#070a1b] hover:brightness-105'
            : 'border border-[#28304a] bg-[#080c1c] text-[#eef3ff] hover:border-[#f3c316] hover:text-[#f3c316]',
          disabled && 'cursor-wait opacity-70',
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
