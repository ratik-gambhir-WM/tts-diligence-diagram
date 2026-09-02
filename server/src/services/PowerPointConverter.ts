import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { importPowerPoint } from '../../../src/lib/import/PowerpointImporter'
import type { PowerPointCanvasJson } from '../../../src/lib/import/PowerpointImportTypes'
import { ApiError } from '../errors'

export type PowerPointConversion = {
  templateJson: PowerPointCanvasJson
  warnings: string[]
}

export interface PowerPointConverter {
  convert(source: Buffer): Promise<PowerPointConversion>
}

export class LibraryPowerPointConverter implements PowerPointConverter {
  async convert(source: Buffer): Promise<PowerPointConversion> {
    validatePowerPointPackage(source)
    const workingDirectory = await mkdtemp(path.join(tmpdir(), 'tts-mermaid-import-'))
    const inputPath = path.join(workingDirectory, 'upload.pptx')
    const outputPath = path.join(workingDirectory, 'upload.canvas.json')

    try {
      await writeFile(inputPath, source)
      const result = await runImporter(inputPath, outputPath)
      return {
        templateJson: result.jsonSpec,
        warnings: result.warnings,
      }
    } finally {
      await rm(workingDirectory, { force: true, recursive: true })
    }
  }
}

async function runImporter(inputPath: string, outputPath: string) {
  try {
    return await importPowerPoint({
      embedAssets: true,
      inputPath,
      outputPath,
    })
  } catch (error) {
    throw new ApiError(
      422,
      'invalid_powerpoint',
      'The uploaded file is not a supported PowerPoint OOXML presentation.',
      { cause: error },
    )
  }
}

function validatePowerPointPackage(source: Buffer) {
  const endOfDirectory = findEndOfCentralDirectory(source)
  if (endOfDirectory === undefined) {
    throw invalidPowerPointError()
  }

  const diskNumber = source.readUInt16LE(endOfDirectory + 4)
  const centralDirectoryDisk = source.readUInt16LE(endOfDirectory + 6)
  const entryCount = source.readUInt16LE(endOfDirectory + 10)
  const directorySize = source.readUInt32LE(endOfDirectory + 12)
  const directoryOffset = source.readUInt32LE(endOfDirectory + 16)
  if (
    diskNumber !== 0
    || centralDirectoryDisk !== 0
    || entryCount === 0xffff
    || directorySize === 0xffffffff
    || directoryOffset === 0xffffffff
    || entryCount > 10_000
    || directoryOffset + directorySize > endOfDirectory
  ) {
    throw invalidPowerPointError()
  }

  const requiredParts = new Set([
    '[Content_Types].xml',
    'ppt/presentation.xml',
    'ppt/_rels/presentation.xml.rels',
  ])
  let offset = directoryOffset
  let uncompressedBytes = 0

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > source.length || source.readUInt32LE(offset) !== 0x02014b50) {
      throw invalidPowerPointError()
    }

    const entryBytes = source.readUInt32LE(offset + 24)
    const nameLength = source.readUInt16LE(offset + 28)
    const extraLength = source.readUInt16LE(offset + 30)
    const commentLength = source.readUInt16LE(offset + 32)
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength
    if (entryBytes === 0xffffffff || nextOffset > source.length) {
      throw invalidPowerPointError()
    }

    uncompressedBytes += entryBytes
    if (entryBytes > 50 * 1024 * 1024 || uncompressedBytes > 250 * 1024 * 1024) {
      throw new ApiError(
        413,
        'powerpoint_too_large',
        'The expanded PowerPoint package exceeds the processing limit.',
      )
    }

    const entryName = source.toString('utf8', offset + 46, offset + 46 + nameLength)
    if (entryName.startsWith('/') || entryName.split('/').includes('..')) {
      throw invalidPowerPointError()
    }
    requiredParts.delete(entryName)
    offset = nextOffset
  }

  if (offset !== directoryOffset + directorySize || requiredParts.size > 0) {
    throw invalidPowerPointError()
  }
}

function findEndOfCentralDirectory(source: Buffer) {
  const minimumOffset = Math.max(0, source.length - 65_557)
  for (let offset = source.length - 22; offset >= minimumOffset; offset -= 1) {
    if (source.readUInt32LE(offset) === 0x06054b50) {
      return offset
    }
  }
  return undefined
}

function invalidPowerPointError() {
  return new ApiError(
    422,
    'invalid_powerpoint',
    'The uploaded file is not a supported PowerPoint OOXML presentation.',
  )
}
