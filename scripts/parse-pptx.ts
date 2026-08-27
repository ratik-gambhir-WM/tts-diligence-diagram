import path from 'node:path'

import { importPowerPoint } from '../src/lib/import/PowerpointImporter'

type CliOptions = {
  embedAssets: boolean
  inputPath?: string
  outputPath?: string
  slide?: number
}

function parseCliOptions(args: string[]): CliOptions {
  const positional: string[] = []
  let embedAssets = false
  let slide: number | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--embed-assets') {
      embedAssets = true
      continue
    }
    if (argument === '--slide') {
      const value = Number(args[index + 1])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--slide must be followed by a positive whole slide number.')
      }
      slide = value
      index += 1
      continue
    }
    if (argument.startsWith('--slide=')) {
      const value = Number(argument.slice('--slide='.length))
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--slide must be a positive whole slide number.')
      }
      slide = value
      continue
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    }
    positional.push(argument)
  }

  if (positional.length > 2) {
    throw new Error('Expected an input .pptx and at most one output .json path.')
  }

  return {
    embedAssets,
    inputPath: positional[0],
    outputPath: positional[1],
    slide,
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  if (!options.inputPath) {
    throw new Error(
      [
        'Usage: npm run pptx:to-json -- <deck.pptx> [output.json] [--slide N] [--embed-assets]',
        '',
        'Without --slide, every slide is written to one TemplateCanvas-compatible JSON file.',
        'Images are written beside the JSON by default; --embed-assets makes the JSON self-contained.',
      ].join('\n'),
    )
  }

  const result = await importPowerPoint({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    slide: options.slide,
    embedAssets: options.embedAssets,
  })

  console.log(
    `Wrote ${result.importedSlideCount} slide(s) to ${path.relative(process.cwd(), result.outputPath)}`,
  )
  console.log('Pass result.jsonSpec directly as template.jsonSpec when calling the library.')
  for (const warning of result.warnings) {
    console.warn(`WARNING ${warning}`)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
