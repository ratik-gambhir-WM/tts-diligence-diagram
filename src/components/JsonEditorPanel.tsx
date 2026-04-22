import { useEffect, useState } from 'react'

type JsonEditorPanelProps = {
  onClose: () => void
  onSave: (value: string) => void
  value: string
}

export function JsonEditorPanel({ onClose, onSave, value }: JsonEditorPanelProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function handleSave() {
    if (!draft.trim()) {
      return
    }

    onSave(draft.trim())
  }

  return (
    <aside
      className="min-h-0 h-full overflow-auto border-l border-[#171717]/10 bg-white/94 p-4 shadow-[-16px_0_40px_rgba(23,23,23,0.08)] backdrop-blur-xl"
      aria-label="Submitted prompt editor"
    >
      <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
        <div>
          <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[#c95518]">Prompt Document</p>
          <h2 className="m-0 text-[1.2rem]">Submitted prompt</h2>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-full border-0 bg-[#171717] px-4 py-2.5 text-[0.95rem] font-bold text-white transition duration-150 ease-out hover:bg-[#2a2a2a]"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <p className="mt-4 text-[#4f4f4f]">Edit the prompt you submitted and save the updated text.</p>

      <label htmlFor="json-editor" className="sr-only">
        Submitted prompt
      </label>
      <textarea
        id="json-editor"
        className="mt-4 min-h-[360px] w-full resize-y rounded-[20px] border border-[#171717]/12 bg-white px-[1.1rem] py-4 font-mono text-[0.92rem] leading-[1.55] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#f26f21] focus:outline-[3px] focus:outline-[#f26f21]/20"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
      />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="cursor-pointer rounded-full border-0 bg-[#171717] px-4 py-2.5 text-[0.95rem] font-bold text-white transition duration-150 ease-out hover:bg-[#2a2a2a]"
          onClick={() => setDraft(value)}
        >
          Reset
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-full border-0 bg-gradient-to-br from-[#f26f21] to-[#c95518] px-4 py-2.5 text-[0.95rem] font-bold text-white shadow-[0_12px_24px_rgba(242,111,33,0.24)] transition duration-150 ease-out hover:-translate-y-px"
          onClick={handleSave}
        >
          Save Prompt
        </button>
      </div>
    </aside>
  )
}
