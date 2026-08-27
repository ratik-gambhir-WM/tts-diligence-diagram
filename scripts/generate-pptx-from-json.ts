import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildThemedPptxBytes,
  buildSuggestedFileName,
  normalizePresentationSpec,
} from '../src/lib/export/PowerpointGenerator'

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
  const { presentation, issues } = normalizePresentationSpec(parsed, {
    baseDir: path.dirname(inputPath),
  })

  const errors = issues.filter((issue) => issue.level === 'error')
  if (!presentation || errors.length > 0) {
    const formattedIssues = issues
      .map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`)
      .join('\n')
    throw new Error(`The JSON could not be converted into a PowerPoint deck.\n${formattedIssues}`)
  }

  for (const issue of issues.filter((issue) => issue.level === 'warning')) {
    console.warn(`WARNING ${issue.path}: ${issue.message}`)
  }

  const defaultFileName = buildSuggestedFileName(presentation)
  const outputPath = resolveOutputPath(inputPath, outputArg, defaultFileName)
  await mkdir(path.dirname(outputPath), { recursive: true })

  await writeFile(outputPath, await buildThemedPptxBytes(presentation))

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
