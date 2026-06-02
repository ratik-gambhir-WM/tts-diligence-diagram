import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  generatePowerPointFromJson,
} from './exporter.ts'

async function main() {
  const [, , inputArg, outputArg] = process.argv

  if (!inputArg) {
    throw new Error(
      'Usage: npm run generate:pptx -- <path-to-json> [output-path-or-directory]',
    )
  }

  const inputPath = path.resolve(process.cwd(), inputArg)
  const raw = await readFile(inputPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  const defaultFileName = deriveDefaultFileName(parsed)
  const outputPath = resolveOutputPath(inputPath, outputArg, defaultFileName)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const { issues } = await generatePowerPointFromJson(parsed, {
    baseDir: path.dirname(inputPath),
    outputPath,
    compression: true,
  })

  for (const issue of issues.filter((issue) => issue.level === 'warning')) {
    console.warn(`WARNING ${issue.path}: ${issue.message}`)
  }

  console.log(outputPath)
}

function deriveDefaultFileName(input: unknown) {
  if (isRecord(input)) {
    const presentationNode = isRecord(input.presentation) ? input.presentation : input
    const title = typeof presentationNode.title === 'string' ? presentationNode.title : undefined
    const stem = title
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (stem) {
      return `${stem}.pptx`
    }
  }

  return 'generated-presentation.pptx'
}

function resolveOutputPath(inputPath: string, outputArg: string | undefined, defaultFileName: string) {
  if (!outputArg) {
    return path.join(path.dirname(inputPath), defaultFileName)
  }

  const resolved = path.resolve(process.cwd(), outputArg)
  if (path.extname(resolved).toLowerCase() === '.pptx') {
    return resolved
  }

  return path.join(resolved, defaultFileName)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
