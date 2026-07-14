import { classNames } from './classNames'
import { WestMonroeMark } from './WestMonroeMark'

type BrandLockupProps = {
  align?: 'center' | 'left'
  className?: string
  eyebrow?: string
  markSize?: 'lg' | 'md'
  title: string
}

export function BrandLockup({
  align = 'left',
  className,
  eyebrow = 'West Monroe',
  markSize = 'md',
  title,
}: BrandLockupProps) {
  return (
    <div
      className={classNames(
        'brand-lockup',
        align === 'center' ? 'brand-lockup-center' : 'brand-lockup-left',
        className,
      )}
    >
      <WestMonroeMark
        className={classNames(
          'brand-lockup-mark',
          markSize === 'lg' ? 'brand-lockup-mark-lg' : 'brand-lockup-mark-md',
        )}
      />
      {align === 'center' ? (
        <span className="brand-lockup-title brand-lockup-title-center">{title}</span>
      ) : (
        <div className="brand-lockup-copy">
          <p className="brand-lockup-eyebrow">{eyebrow}</p>
          <h1 className="brand-lockup-title brand-lockup-title-left">{title}</h1>
        </div>
      )}
    </div>
  )
}
