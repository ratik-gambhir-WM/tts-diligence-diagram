import { classNames } from './classNames'

type PatternOverlayProps = {
  className?: string
}

export function PatternOverlay({ className }: PatternOverlayProps) {
  return (
    <div className={classNames('pattern-overlay', className)}>
      <div className="pattern-overlay-line pattern-overlay-line-one" />
      <div className="pattern-overlay-line pattern-overlay-line-two" />
      <div className="pattern-overlay-line pattern-overlay-line-three" />
      <div className="pattern-overlay-line pattern-overlay-line-four" />
    </div>
  )
}
