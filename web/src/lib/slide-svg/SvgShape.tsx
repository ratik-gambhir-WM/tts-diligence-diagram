import { memo } from 'react'

import type { EditableCanvasShapeElement } from '../canvas-model/CanvasTypes'
import { renderShapePrimitive } from './shapes'
import { SvgTextBlock } from './SvgText'

export const SvgShape = memo(function SvgShape({
  element,
  fontScale,
  hideText = false,
  textClipId,
}: {
  element: EditableCanvasShapeElement
  fontScale?: number
  hideText?: boolean
  textClipId: string
}) {
  return (
    <>
      {renderShapePrimitive(element)}
      {!hideText && (element.label || element.textRuns.length) ? (
        <SvgTextBlock clipId={textClipId} element={element} fontScale={fontScale} />
      ) : null}
    </>
  )
})
