import { classNames } from './classNames'

type PatternOverlayProps = {
  className?: string
}

export function PatternOverlay({ className }: PatternOverlayProps) {
  return (
    <div className={classNames('pointer-events-none absolute inset-0 opacity-45', className)}>
      <div className="absolute left-[-10%] top-16 h-px w-[120%] rotate-12 bg-white/8" />
      <div className="absolute left-[-10%] top-48 h-px w-[120%] -rotate-6 bg-white/8" />
      <div className="absolute left-24 top-[-20%] h-[140%] w-px rotate-[-18deg] bg-white/8" />
      <div className="absolute right-24 top-[-20%] h-[140%] w-px rotate-[24deg] bg-white/8" />
    </div>
  )
}
