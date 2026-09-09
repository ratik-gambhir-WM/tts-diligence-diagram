const slideAssetUrls = import.meta.glob('../../slide-assets/*', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const slideAssetUrlByName = new Map(
  Object.entries(slideAssetUrls).flatMap(([path, url]) => {
    const fileName = path.split('/').pop()
    return fileName ? [[fileName, url] as const] : []
  }),
)

export function resolveBundledSlideAssetImageSources(input: JsonValue): JsonValue {
  if (Array.isArray(input)) {
    return input.map(resolveBundledSlideAssetImageSources)
  }

  if (!isPlainRecord(input)) {
    return input
  }

  const isImageElement =
    asLowercaseString(input.kind) === 'image' ||
    asLowercaseString(input.type) === 'image' ||
    asLowercaseString(input.type) === 'picture'
  const resolved: JsonObject = {}

  for (const [key, value] of Object.entries(input)) {
    if (isImageElement && (key === 'src' || key === 'path' || key === 'data')) {
      resolved[key] = resolveBundledSlideAssetUrl(value)
      continue
    }

    resolved[key] = value === undefined ? undefined : resolveBundledSlideAssetImageSources(value)
  }

  return resolved
}

function resolveBundledSlideAssetUrl(value: JsonValue | undefined) {
  if (typeof value !== 'string') {
    return value
  }

  const fileName = value.split(/[\\/]/u).pop()?.split(/[?#]/u)[0]
  if (!fileName) {
    return value
  }

  return slideAssetUrlByName.get(fileName) ?? value
}

function isPlainRecord(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asLowercaseString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value.toLowerCase() : undefined
}
import type { JsonObject, JsonValue } from '../shared/PowerpointTypes'
