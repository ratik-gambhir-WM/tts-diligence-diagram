export {
  applyElementEdit,
  applyElementEditsToInput,
  applyElementEditToInput,
  deleteElementsFromInput,
  type ElementEdit,
  type ElementEditRequest,
  type ElementMutationLocator,
} from './edits'
export {
  getElementAccessibleLabel,
  getElementGeometry,
  roundCoordinate,
  type BoxGeometry,
  type ElementGeometry,
  type LineGeometry,
} from './geometry'
export {
  buildSlideCanvasModel,
  type BuildSlideCanvasModelOptions,
  type SlideCanvasModel,
  type SlideElementRef,
} from './model'
export { buildNormalizedTextRuns, buildRawTextRuns } from './textRuns'
