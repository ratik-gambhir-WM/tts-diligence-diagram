import { memo } from 'react'

import logoAsset from '../../slide-assets/element-5.png'
import frameAsset from '../../slide-assets/west-monroe-frame.svg'

export const SvgBrandFrame = memo(function SvgBrandFrame({
  height,
  width,
}: {
  height: number
  width: number
}) {
  const scaleX = width / 1280
  const scaleY = height / 720

  return (
    <g aria-label="West Monroe branded slide frame" pointerEvents="none">
      <image
        height={height}
        href={frameAsset}
        preserveAspectRatio="none"
        width={width}
        x={0}
        y={0}
      />
      <image
        height={32.02 * scaleY}
        href={logoAsset}
        preserveAspectRatio="xMidYMid meet"
        width={153 * scaleX}
        x={48.33 * scaleX}
        y={664.08 * scaleY}
      />
    </g>
  )
})

