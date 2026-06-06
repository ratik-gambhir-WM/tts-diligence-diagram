import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { classNames } from './classNames'

type ButtonVariant = 'ghost' | 'icon' | 'link' | 'primary' | 'secondary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
}

const baseClasses =
  'cursor-pointer font-bold transition disabled:cursor-not-allowed disabled:opacity-70'

const variantClasses: Record<ButtonVariant, string> = {
  ghost:
    'border-0 bg-transparent text-[#8d93aa] uppercase tracking-[0.1em] hover:text-[#f3c316]',
  icon:
    'grid place-items-center rounded-full border border-[#f3c316] bg-[#f3c316] text-[#070a1b] shadow-[0_10px_24px_rgba(0,0,0,0.22)] hover:brightness-105',
  link:
    'border-0 bg-transparent p-0 text-[#f3c316] underline-offset-4 hover:text-[#ffe07a] hover:underline',
  primary:
    'border border-[#f3c316] bg-[#f3c316] text-[#070a1b] uppercase tracking-[0.12em] hover:brightness-105',
  secondary:
    'border border-[#28304a] bg-[#080c1c] text-[#eef3ff] uppercase tracking-[0.12em] hover:border-[#f3c316] hover:text-[#f3c316]',
}

export function Button({ children, className, type = 'button', variant = 'secondary', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  )
}
