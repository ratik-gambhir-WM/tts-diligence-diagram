import type { InputHTMLAttributes, ReactNode } from 'react'

import { classNames } from './classNames'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  addon?: ReactNode
  help?: ReactNode
  label: string
}

export function TextField({ addon, className, help, id, label, ...inputProps }: TextFieldProps) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label
          className="block text-[0.72rem] font-bold tracking-[0.18em] text-[#8d93aa] uppercase"
          htmlFor={id}
        >
          {label}
        </label>
        {help}
      </div>
      <div className="flex overflow-hidden rounded-[1.15rem] border border-[#28304a] bg-[#080c1c] focus-within:border-[#dfe8fb]">
        <input
          id={id}
          className={classNames(
            'min-w-0 flex-1 border-0 bg-[#dfe8fb] px-3.5 py-3 text-[0.95rem] text-[#070a1b] outline-none',
            className,
          )}
          {...inputProps}
        />
        {addon && (
          <span className="flex shrink-0 items-center border-l border-[#28304a] px-3 text-[0.84rem] font-bold tracking-normal text-[#8d93aa]">
            {addon}
          </span>
        )}
      </div>
    </div>
  )
}
