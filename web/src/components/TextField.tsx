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
      <div className="text-field-header">
        <label className="text-field-label" htmlFor={id}>
          {label}
        </label>
        {help}
      </div>
      <div className="text-field-control">
        <input
          id={id}
          className={classNames(
            'text-field-input',
            className,
          )}
          {...inputProps}
        />
        {addon && (
          <span className="text-field-addon">{addon}</span>
        )}
      </div>
    </div>
  )
}
