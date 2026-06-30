const COMMENTARY_FINDING_X_MIN = 430
const COMMENTARY_FINDING_Y_MIN = 90
const ORDERED_BULLET_PREFIX_SPACING = ' '

type MutableRecord = Record<string, unknown>

export function ensureCommentaryBulletOrdering(input: unknown): unknown {
  const nextInput = cloneJsonValue(input)

  normalizeCommentaryFindingElements(nextInput)

  return nextInput
}

function normalizeCommentaryFindingElements(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(normalizeCommentaryFindingElements)
    return
  }

  if (!isRecord(value)) {
    return
  }

  if (isCommentaryFindingTextElement(value)) {
    normalizeCommentaryFindingTextElement(value)
  }

  Object.values(value).forEach(normalizeCommentaryFindingElements)
}

function isCommentaryFindingTextElement(element: MutableRecord) {
  const runs = Array.isArray(element.runs) ? element.runs.filter(isRecord) : []

  return (
    element.type === 'text' &&
    asNumber(element.x) >= COMMENTARY_FINDING_X_MIN &&
    asNumber(element.y) >= COMMENTARY_FINDING_Y_MIN &&
    runs.length >= 2 &&
    asString(element.text).includes('\n')
  )
}

function normalizeCommentaryFindingTextElement(element: MutableRecord) {
  const runs = Array.isArray(element.runs) ? element.runs.filter(isRecord) : []

  runs.forEach((run, index) => {
    if (index === 0) {
      return
    }

    const text = asString(run.text)
    const content = stripBulletPrefix(text)

    run.text = content.trim()
      ? `${indexToLowerAlpha(index - 1)})${ORDERED_BULLET_PREFIX_SPACING}${content}`
      : text
  })

  element.text = runs.map((run) => asString(run.text)).join('\n')
}

function stripBulletPrefix(text: string) {
  return text
    .replace(/^\s*[a-z]{1,2}[\).]\s*/i, '')
    .replace(/^\s*[•\-–]\s*/, '')
}

function indexToLowerAlpha(index: number) {
  let remaining = index
  let label = ''

  do {
    label = String.fromCharCode(97 + (remaining % 26)) + label
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)

  return label
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)]),
    ) as T
  }

  return value
}

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}
