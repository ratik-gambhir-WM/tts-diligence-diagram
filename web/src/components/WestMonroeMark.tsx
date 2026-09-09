import { classNames } from './classNames'

type WestMonroeMarkProps = {
  className?: string
  framed?: boolean
}

const squareSize = 14
const radius = 1.5

const pieces = [
  { rotation: 0, x: 17, y: 17 },
  { rotation: 45, x: 41, y: 7 },
  { rotation: 0, x: 65, y: 17 },
  { rotation: 45, x: 75, y: 41 },
  { rotation: 0, x: 65, y: 65 },
  { rotation: 45, x: 41, y: 75 },
  { rotation: 0, x: 17, y: 65 },
  { rotation: 45, x: 7, y: 41 },
]

export function WestMonroeMark({ className = 'west-monroe-mark-md', framed = false }: WestMonroeMarkProps) {
  const mark = (
    <svg
      aria-hidden="true"
      className={framed ? 'west-monroe-mark-framed-icon' : classNames('west-monroe-mark', className)}
      viewBox="0 0 96 96"
    >
      {pieces.map((piece) => (
        <rect
          className="west-monroe-mark-piece"
          height={squareSize}
          key={`${piece.x}-${piece.y}`}
          rx={radius}
          transform={
            piece.rotation
              ? `rotate(${piece.rotation} ${piece.x + squareSize / 2} ${piece.y + squareSize / 2})`
              : undefined
          }
          width={squareSize}
          x={piece.x}
          y={piece.y}
        />
      ))}
    </svg>
  )

  if (!framed) {
    return mark
  }

  return (
    <span className={classNames('west-monroe-mark-frame', className)}>
      {mark}
    </span>
  )
}
