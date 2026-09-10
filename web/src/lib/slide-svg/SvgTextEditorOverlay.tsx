import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

import type {
  EditableCanvasShapeElement,
  EditableCanvasTextElement,
  EditableCanvasTextRun,
} from '../canvas-model/CanvasTypes'
import type { SvgTextLayout } from './textLayout'
import { getSvgTextContent } from './svgTextLayout'
import { toSvgColor } from './svgUtils'

type EditableTextElement = EditableCanvasShapeElement | EditableCanvasTextElement

type EditableRun = {
  height: number
  run: EditableCanvasTextRun
  top: number
}

type OverlayPosition = {
  height: number
  left: number
  scale: number
  top: number
  width: number
}

export function SvgTextEditorOverlay({
  containerRef,
  coordinateRootRef,
  element,
  fontScale,
  onCancel,
  onCommit,
  viewportTransform,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  coordinateRootRef: RefObject<SVGGraphicsElement | null>
  element: EditableTextElement
  fontScale?: number
  onCancel: () => void
  onCommit: (text: string) => void
  viewportTransform: string
}) {
  const initialText = element.kind === 'text' ? element.text : element.label
  const textContent = useMemo(
    () => getSvgTextContent(element, fontScale),
    [element, fontScale],
  )
  const editableRuns = useMemo(
    () => getEditableRuns(textContent.runs, textContent.fallbackRun, textContent.layout),
    [textContent],
  )
  const editorRefs = useRef<Array<HTMLDivElement | null>>([])
  const draftRef = useRef(editableRuns.map(({ run }) => run.text))
  const cancelledRef = useRef(false)
  const didFocusRef = useRef(false)
  const dirtyRef = useRef(false)
  const [position, setPosition] = useState<OverlayPosition>()

  useEffect(() => {
    if (!position || didFocusRef.current) {
      return
    }

    const editor = editorRefs.current.at(-1)
    if (!editor) {
      return
    }

    didFocusRef.current = true
    editor.focus({ preventScroll: true })
    placeCaretAtEnd(editor)
  }, [position])

  useEffect(() => {
    const coordinateRoot = coordinateRootRef.current
    const container = containerRef.current
    if (!coordinateRoot || !container) {
      return
    }

    const updatePosition = () => {
      const matrix = coordinateRoot.getScreenCTM()
      if (!matrix) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const topLeft = new DOMPoint(element.x, element.y).matrixTransform(matrix)
      const scale = Math.hypot(matrix.a, matrix.b)
      setPosition({
        height: element.h * scale,
        left: topLeft.x - containerRect.left,
        scale,
        top: topLeft.y - containerRect.top,
        width: element.w * scale,
      })
    }

    updatePosition()
    const observer = new ResizeObserver(updatePosition)
    observer.observe(container)
    observer.observe(coordinateRoot)
    window.addEventListener('resize', updatePosition)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updatePosition)
    }
  }, [containerRef, coordinateRootRef, element.h, element.w, element.x, element.y, viewportTransform])

  if (!position) {
    return null
  }

  const editorStyle: CSSProperties = {
    height: position.height,
    left: position.left,
    top: position.top,
    transform: element.rotate ? `rotate(${element.rotate}deg)` : undefined,
    width: position.width,
  }
  const commitDraft = () => {
    onCommit(
      dirtyRef.current
        ? joinEditableRuns(editableRuns, draftRef.current)
        : initialText,
    )
  }
  const firstRunTop = editableRuns[0]?.top ?? element.padding

  return (
    <div
      className="svg-slide-text-editor"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return
        }

        if (!cancelledRef.current) {
          commitDraft()
        }
      }}
      style={editorStyle}
    >
      <div
        className="svg-slide-text-editor-content"
        style={{
          paddingLeft: element.padding * position.scale,
          paddingRight: element.padding * position.scale,
          paddingTop: firstRunTop * position.scale,
          textAlign: element.align,
        }}
      >
        {editableRuns.map(({ height, run, top }, runIndex) => {
          const previousRun = editableRuns[runIndex - 1]
          const gap = previousRun
            ? Math.max(top - previousRun.top - previousRun.height, 0)
            : 0

          return (
            <div
              aria-label={
                runIndex === 0
                  ? 'Edit slide text'
                  : `Edit slide text paragraph ${runIndex + 1}`
              }
              className="svg-slide-text-editor-input"
              contentEditable
              data-editor-paragraph=""
              key={runIndex}
              onInput={(event) => {
                dirtyRef.current = true
                draftRef.current[runIndex] = readEditableText(event.currentTarget)
              }}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelledRef.current = true
                  onCancel()
                  return
                }

                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  cancelledRef.current = true
                  commitDraft()
                }
              }}
              ref={(editor) => {
                editorRefs.current[runIndex] = editor
              }}
              role="textbox"
              spellCheck={false}
              style={{
                color: toSvgColor(run.color),
                fontFamily: run.fontFace,
                fontSize: Math.max(
                  run.fontSize * textContent.layout.fontScale * position.scale,
                  5,
                ),
                fontStyle: run.italic ? 'italic' : 'normal',
                fontWeight: run.bold ? 700 : 400,
                lineHeight: 1.05,
                marginTop: gap * position.scale,
                minHeight: height * position.scale,
                textDecoration: run.underline ? 'underline' : undefined,
              }}
              suppressContentEditableWarning
            >
              {run.text || <br />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getEditableRuns(
  runs: EditableCanvasTextRun[],
  fallbackRun: EditableCanvasTextRun,
  layout: SvgTextLayout,
): EditableRun[] {
  const runGroups = groupParagraphRuns(runs.length > 0 ? runs : [fallbackRun])
  let previousBottom = layout.lines[0]
    ? layout.lines[0].baseline - layout.lines[0].height * 0.82
    : 0

  return runGroups.map((sourceRuns) => {
    const styleRun = sourceRuns.reduce((dominantRun, run) =>
      visibleTextLength(run.text) > visibleTextLength(dominantRun.text)
        ? run
        : dominantRun,
    )
    const run: EditableCanvasTextRun = {
      ...styleRun,
      breakLine: sourceRuns.at(-1)?.breakLine,
      text: sourceRuns.map((sourceRun) => sourceRun.text).join(''),
    }
    const matchingLines = layout.lines.filter((line) =>
      line.segments.some((segment) => sourceRuns.includes(segment.run)),
    )
    const firstLine = matchingLines[0]
    const lastLine = matchingLines.at(-1)
    const top = firstLine
      ? firstLine.baseline - firstLine.height * 0.82
      : previousBottom
    const bottom = lastLine
      ? lastLine.baseline - lastLine.height * 0.82 + lastLine.height
      : top + Math.max(run.fontSize * layout.fontScale * 1.05, 5.25)
    previousBottom = bottom

    return {
      height: Math.max(bottom - top, 5.25),
      run,
      top,
    }
  })
}

function groupParagraphRuns(runs: EditableCanvasTextRun[]) {
  const groups: EditableCanvasTextRun[][] = []
  let currentGroup: EditableCanvasTextRun[] = []

  runs.forEach((run) => {
    currentGroup.push(run)
    if (run.breakLine || run.text.includes('\n')) {
      groups.push(currentGroup)
      currentGroup = []
    }
  })

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

function visibleTextLength(text: string) {
  return text.replace(/\u200b/g, '').length
}

function readEditableText(editor: HTMLDivElement) {
  if (typeof editor.innerText === 'string') {
    return editor.innerText.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
  }

  return (editor.textContent ?? '').replace(/\u00a0/g, ' ')
}

function joinEditableRuns(editableRuns: EditableRun[], drafts: string[]) {
  return editableRuns
    .map(({ run }, index) => {
      const shouldBreak = run.breakLine && index < editableRuns.length - 1
      return `${drafts[index] ?? ''}${shouldBreak ? '\n' : ''}`
    })
    .join('')
}

function placeCaretAtEnd(editor: HTMLDivElement) {
  const selection = window.getSelection()
  if (!selection) {
    return
  }

  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}
