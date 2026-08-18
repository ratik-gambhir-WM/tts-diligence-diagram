import { memo } from 'react'

import type { NormalizedImageElement } from '../export/PowerpointTypes'

export const SvgImage = memo(function SvgImage({
  clipId,
  element,
}: {
  clipId: string
  element: NormalizedImageElement
}) {
  return (
    <>
      <title>{element.altText || 'Slide image'}</title>
      <defs>
        <clipPath id={clipId}>
          <rect
            height={element.h}
            rx={element.borderRadius}
            width={element.w}
            x={0}
            y={0}
          />
        </clipPath>
      </defs>
      <image
        clipPath={`url(#${clipId})`}
        height={element.h}
        href={element.src}
        preserveAspectRatio={getPreserveAspectRatio(element.fit)}
        width={element.w}
        x={0}
        y={0}
      />
    </>
  )
})

function getPreserveAspectRatio(fit: NormalizedImageElement['fit']) {
  if (fit === 'stretch') {
    return 'none'
  }
  if (fit === 'cover') {
    return 'xMidYMid slice'
  }
  return 'xMidYMid meet'
}

