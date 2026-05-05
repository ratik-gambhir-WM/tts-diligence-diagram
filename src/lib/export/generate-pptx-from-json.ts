import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildSuggestedFileName,
  generatePowerPointFromPresentation,
  normalizeJsonToPresentation,
} from './index.ts'

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
  const { presentation, issues } = normalizeJsonToPresentation(parsed, {
    baseDir: path.dirname(inputPath),
  })

  for (const issue of issues.filter((issue) => issue.level === 'warning')) {
    console.warn(`WARNING ${issue.path}: ${issue.message}`)
  }

  const defaultFileName = buildSuggestedFileName(presentation)
  const outputPath = resolveOutputPath(inputPath, outputArg, defaultFileName)
  await mkdir(path.dirname(outputPath), { recursive: true })

  await generatePowerPointFromPresentation(presentation, {
    outputPath,
    compression: true,
  })

  console.log(outputPath)
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
