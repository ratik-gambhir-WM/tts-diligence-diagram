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
        align === 'center'
          ? 'mx-auto flex flex-wrap items-center justify-center gap-5'
          : 'flex items-center gap-4',
        className,
      )}
    >
      <WestMonroeMark
        className={classNames(
          markSize === 'lg' ? 'h-20 w-20 max-[480px]:h-16 max-[480px]:w-16' : 'h-12 w-12',
          '[&_rect]:fill-[#f3c316]',
        )}
      />
      {align === 'center' ? (
        <span className="whitespace-nowrap text-[3rem] font-bold leading-none tracking-normal text-white max-[480px]:text-[2rem]">
          {title}
        </span>
      ) : (
        <div>
          <p className="text-[0.72rem] font-bold tracking-[0.18em] text-[#f3c316] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
        </div>
      )}
    </div>
  )
}
