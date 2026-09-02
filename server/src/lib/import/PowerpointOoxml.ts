import path from 'node:path'
import type JSZip from 'jszip'

import { EMU_PER_INCH, PX_PER_INCH } from '../shared/PowerpointConstants'
import type { ExtractedRelationship } from '../shared/PowerpointTypes'
import type { ExtractedSupportPartRecord } from './PowerpointImportTypes'
import { round } from './PowerpointImportUtils'
import { descendants, findDescendant, parseXml } from './PowerpointXml'

export async function collectSupportParts(zip: JSZip, relationships: ExtractedRelationship[]) {
  const supportParts: Record<string, ExtractedSupportPartRecord> = {}
  const themeXml = await maybeReadZipText(zip, 'ppt/theme/theme1.xml')

  if (themeXml) {
    supportParts['ppt/theme/theme1.xml'] = {
      path: 'ppt/theme/theme1.xml',
      size: Buffer.byteLength(themeXml),
      relationshipType: 'theme',
      contentTypeHint: 'application/xml',
      rawXml: themeXml,
    }
  }

  for (const relationship of relationships) {
    if (!relationship.resolvedTarget || !relationship.Type?.includes('/image')) {
      continue
    }

    const bytes = await maybeReadZipBytes(zip, relationship.resolvedTarget)
    if (!bytes) {
      continue
    }

    supportParts[relationship.resolvedTarget] = {
      path: relationship.resolvedTarget,
      size: bytes.length,
      relationshipType: relationship.Type,
      contentTypeHint: imageContentType(relationship.resolvedTarget),
      base64: bytes.toString('base64'),
    }
  }

  return supportParts
}

export function extractSlidePaths(presentationXml: string, relationships: ExtractedRelationship[]) {
  const presentation = parseXml(presentationXml)
  const relById = new Map(relationships.map((relationship) => [relationship.Id, relationship]))
  return descendants(presentation, 'p:sldId')
    .map((slideId) => relById.get(slideId.attributes?.['r:id'] ?? '')?.resolvedTarget)
    .filter((target): target is string => !!target)
}

export function extractSlideSize(presentationXml: string) {
  const presentation = parseXml(presentationXml)
  const sldSz = findDescendant(presentation, 'p:sldSz')
  const cx = Number(sldSz?.attributes?.cx) || 12192000
  const cy = Number(sldSz?.attributes?.cy) || 6858000
  return {
    cx,
    cy,
    widthPx: round((cx / EMU_PER_INCH) * PX_PER_INCH),
    heightPx: round((cy / EMU_PER_INCH) * PX_PER_INCH),
  }
}

export function parseRelationships(xml: string, baseDir: string): ExtractedRelationship[] {
  const root = parseXml(xml)
  return descendants(root, 'Relationship').map((relationship) => {
    const Type = relationship.attributes?.Type
    const Target = relationship.attributes?.Target
    return {
      Id: relationship.attributes?.Id ?? '',
      Type,
      Target,
      resolvedTarget: Target ? resolvePartPath(baseDir, Target) : undefined,
      typeShort: Type?.split('/').pop(),
    }
  })
}

export async function readZipText(zip: JSZip, filePath: string) {
  const file = zip.file(filePath)
  if (!file) {
    throw new Error(`Missing expected PowerPoint part: ${filePath}`)
  }
  return file.async('text')
}

export async function maybeReadZipText(zip: JSZip, filePath: string) {
  return zip.file(filePath)?.async('text')
}

export async function maybeReadZipBytes(zip: JSZip, filePath: string) {
  const bytes = await zip.file(filePath)?.async('nodebuffer')
  return bytes
}

export function relationshipPathFor(partPath: string) {
  const directory = path.posix.dirname(partPath)
  const base = path.posix.basename(partPath)
  return path.posix.join(directory, '_rels', `${base}.rels`)
}

function resolvePartPath(baseDir: string, target: string) {
  if (/^[a-z]+:/iu.test(target)) {
    return target
  }
  return path.posix.normalize(path.posix.join(baseDir, target))
}

function imageContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }
  if (extension === '.svg') {
    return 'image/svg+xml'
  }
  if (extension === '.gif') {
    return 'image/gif'
  }
  if (extension === '.emf') {
    return 'image/emf'
  }
  return 'image/png'
}
