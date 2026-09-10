import { useState } from 'react'

import { AppNav } from '../components/AppNav'
import { Button } from '../components/Button'
import { PageShell } from '../components/PageShell'
import { downloadPowerPoint } from '../lib/api/download'
import { exportPresentation } from '../lib/api/templateApi'
import type { JsonValue } from '../lib/canvas-model/CanvasTypes'

type JsonInputPageProps = {
  onOpenCommentaryPicker: () => void
  onOpenDiagramPicker: () => void
  onOpenInputPage: () => void
  onOpenJsonInput: () => void
}

export function JsonInputPage({
  onOpenCommentaryPicker,
  onOpenDiagramPicker,
  onOpenInputPage,
  onOpenJsonInput,
}: JsonInputPageProps) {
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    setError('')
    setStatus('')

    if (!jsonInput.trim()) {
      setError('Add JSON before exporting.')
      return
    }

    setIsExporting(true)

    try {
      const parsed = JSON.parse(jsonInput) as unknown
      if (!isJsonValue(parsed)) {
        throw new Error('The input must be valid JSON without unsupported values.')
      }
      const result = await exportPresentation(parsed)
      downloadPowerPoint(result)
      setStatus(`Created ${result.fileName}.`)
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Failed to export JSON to PowerPoint.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageShell>
      <AppNav
        activePage="json-input"
        onOpenCommentaryPicker={onOpenCommentaryPicker}
        onOpenDiagramPicker={onOpenDiagramPicker}
        onOpenInputPage={onOpenInputPage}
        onOpenJsonInput={onOpenJsonInput}
      />

      <section className="mx-auto grid min-h-0 w-full max-w-[1180px] flex-1 place-items-center px-2 py-12">
        <div className="w-full">
          <h1 className="text-center text-[clamp(2rem,4.5vw,4rem)] font-bold leading-tight text-white">
            What JSON are we testing today?
          </h1>

          <div className="mt-12 rounded-[2rem] border border-white/18 bg-[#0b0f24] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.42)] max-[640px]:rounded-[1.5rem]">
            <div className="flex min-h-[21rem] gap-4 rounded-[1.55rem] border border-[#28304a] bg-[#080c1c] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-[#f3c316] max-[640px]:min-h-[18rem] max-[640px]:p-4">
              <div
                className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/14 text-[1.8rem] leading-none text-[#f3c316]"
                aria-hidden="true"
              >
                +
              </div>
              <textarea
                value={jsonInput}
                onChange={(event) => {
                  setJsonInput(event.currentTarget.value)
                  setError('')
                  setStatus('')
                }}
                placeholder="Paste JSON"
                spellCheck={false}
                className="min-h-[19rem] flex-1 resize-none border-0 bg-transparent py-1 font-mono text-[0.95rem] leading-6 text-[#eef3ff] outline-none placeholder:font-sans placeholder:text-[#8d93aa] max-[640px]:min-h-[16rem]"
                aria-label="JSON input"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2">
              <div className="min-h-6 text-[0.9rem] leading-6">
                {error && <p className="m-0 text-[#ffb5b5]">{error}</p>}
                {!error && status && <p className="m-0 text-[#c7f7d8]">{status}</p>}
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={handleExport}
                disabled={isExporting || !jsonInput.trim()}
                className="min-h-12 px-7 text-[0.9rem]"
              >
                {isExporting ? 'Exporting' : 'Export PowerPoint'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value !== 'object') return false
  return Object.values(value).every((entry) => entry === undefined || isJsonValue(entry))
}
