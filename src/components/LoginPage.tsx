import { useState, type FormEvent } from 'react'

import { WestMonroeMark } from './WestMonroeMark'

type LoginPageProps = {
  initialEmailLocalPart?: string
  onSubmit: (credentials: { email: string }) => void
}

const emailDomain = '@westmonroe.com'
const apiKeyHelpMarkdown = `
## How to get an OpenAI API key

1. Sign in to the [OpenAI Platform](https://platform.openai.com/).
2. Open **API keys** from your project settings.
3. Create a new secret key and copy it.
4. Store it in your local environment as \`VITE_OPENAI_API_KEY\`.

- Keep your key private.
- If a key is exposed, revoke it and create a new one.
`

export function LoginPage({ initialEmailLocalPart = '', onSubmit }: LoginPageProps) {
  const [apiKey, setApiKey] = useState('')
  const [emailLocalPart, setEmailLocalPart] = useState(initialEmailLocalPart)
  const [error, setError] = useState('')
  const [isApiKeyHelpOpen, setIsApiKeyHelpOpen] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmailLocalPart = normalizeEmailLocalPart(emailLocalPart)

    if (!normalizedEmailLocalPart) {
      setError('Enter your West Monroe email.')
      return
    }

    setError('')
    onSubmit({
      email: `${normalizedEmailLocalPart}${emailDomain}`,
    })
  }

  return (
    <>
      <main className="grid min-h-screen place-items-center bg-[#070a1b] px-6 py-8 text-[#eef3ff]">
        <section className="relative w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b0f24] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
          <div className="pointer-events-none absolute inset-0 opacity-45">
            <div className="absolute left-[-10%] top-16 h-px w-[120%] rotate-12 bg-white/8" />
            <div className="absolute left-[-10%] top-44 h-px w-[120%] -rotate-6 bg-white/8" />
            <div className="absolute left-24 top-[-20%] h-[140%] w-px rotate-[-18deg] bg-white/8" />
            <div className="absolute right-24 top-[-20%] h-[140%] w-px rotate-[24deg] bg-white/8" />
          </div>

          <div className="relative">
            <div className="mb-8 flex items-center gap-4">
              <WestMonroeMark className="h-12 w-12 [&_rect]:fill-[#f3c316]" />
              <div>
                <p className="text-[0.72rem] font-bold tracking-[0.18em] text-[#f3c316] uppercase">
                  West Monroe
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">Diligence Studio</h1>
              </div>
            </div>

            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div>
                <label
                  className="mb-2 block text-[0.72rem] font-bold tracking-[0.18em] text-[#8d93aa] uppercase"
                  htmlFor="wm-email-local-part"
                >
                  WM Email
                </label>
                <div className="flex overflow-hidden rounded-[1.15rem] border border-[#28304a] bg-[#080c1c] focus-within:border-[#dfe8fb]">
                  <input
                    id="wm-email-local-part"
                    name="wm-email-local-part"
                    autoComplete="username"
                    value={emailLocalPart}
                    onChange={(event) => setEmailLocalPart(normalizeEmailLocalPart(event.target.value))}
                    className="min-w-0 flex-1 border-0 bg-[#dfe8fb] px-3.5 py-3 text-[0.95rem] text-[#070a1b] outline-none"
                    placeholder="rgambhir"
                  />
                  <span className="flex shrink-0 items-center border-l border-[#28304a] px-3 text-[0.84rem] font-bold tracking-normal text-[#8d93aa]">
                    {emailDomain}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <label
                    className="block text-[0.72rem] font-bold tracking-[0.18em] text-[#8d93aa] uppercase"
                    htmlFor="openai-api-key"
                  >
                    OpenAI API Key
                  </label>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-right text-[0.74rem] font-bold text-[#f3c316] underline-offset-4 transition hover:text-[#ffe07a] hover:underline"
                    onClick={() => setIsApiKeyHelpOpen(true)}
                  >
                    How do I get an OpenAI API Key?
                  </button>
                </div>
                <div className="overflow-hidden rounded-[1.15rem] border border-[#28304a] bg-[#080c1c] focus-within:border-[#dfe8fb]">
                  <input
                    id="openai-api-key"
                    name="openai-api-key"
                    autoComplete="off"
                    spellCheck={false}
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    className="w-full border-0 bg-[#dfe8fb] px-3.5 py-3 text-[0.95rem] text-[#070a1b] outline-none"
                    placeholder="sk-..."
                  />
                </div>
              </div>

              {error && <p className="text-[0.84rem] leading-5 text-[#ffb5b5]">{error}</p>}

              <button
                type="submit"
                className="mt-1 cursor-pointer rounded-[1.15rem] border border-[#f3c316] bg-[#f3c316] px-5 py-3 text-[0.88rem] font-bold tracking-[0.14em] text-[#070a1b] uppercase transition hover:brightness-105"
              >
                Continue
              </button>
            </form>
          </div>
        </section>
      </main>

      {isApiKeyHelpOpen && (
        <ApiKeyHelpModal
          markdown={apiKeyHelpMarkdown}
          onClose={() => setIsApiKeyHelpOpen(false)}
        />
      )}
    </>
  )
}

function normalizeEmailLocalPart(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/@westmonroe\.com$/i, '')
    .replace(/@.*/, '')
}

type ApiKeyHelpModalProps = {
  markdown: string
  onClose: () => void
}

function ApiKeyHelpModal({ markdown, onClose }: ApiKeyHelpModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#070a1b]/80 px-6 py-8 backdrop-blur-sm">
      <div
        aria-labelledby="api-key-help-title"
        aria-modal="true"
        className="w-full max-w-[560px] rounded-[1.5rem] border border-white/12 bg-[#0b0f24] p-6 text-[#eef3ff] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="api-key-help-title" className="text-xl font-bold text-white">
            OpenAI API Key
          </h2>
          <button
            type="button"
            className="cursor-pointer rounded-full border border-[#28304a] px-4 py-2 text-[0.78rem] font-bold text-[#eef3ff] transition hover:border-[#dfe8fb]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <MarkdownRenderer markdown={markdown} />
      </div>
    </div>
  )
}

type MarkdownRendererProps = {
  markdown: string
}

function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(markdown)

  return (
    <div className="space-y-4 text-[0.95rem] leading-6 text-[#c9d0e4]">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h2':
            return (
              <h3 key={index} className="text-lg font-bold text-white">
                {renderInlineMarkdown(block.text)}
              </h3>
            )
          case 'ol':
            return (
              <ol key={index} className="list-decimal space-y-2 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                ))}
              </ol>
            )
          case 'ul':
            return (
              <ul key={index} className="list-disc space-y-2 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                ))}
              </ul>
            )
          case 'p':
            return <p key={index}>{renderInlineMarkdown(block.text)}</p>
        }
      })}
    </div>
  )
}

type MarkdownBlock =
  | { text: string; type: 'h2' }
  | { text: string; type: 'p' }
  | { items: string[]; type: 'ol' }
  | { items: string[]; type: 'ul' }

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let listItems: string[] = []
  let listType: 'ol' | 'ul' | null = null

  function flushList() {
    if (!listType || listItems.length === 0) {
      return
    }

    blocks.push({ items: listItems, type: listType })
    listItems = []
    listType = null
  }

  for (const line of markdown.trim().split('\n')) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      flushList()
      continue
    }

    if (trimmedLine.startsWith('## ')) {
      flushList()
      blocks.push({ text: trimmedLine.replace(/^##\s+/, ''), type: 'h2' })
      continue
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/)

    if (orderedListMatch) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }

      listItems.push(orderedListMatch[1])
      continue
    }

    if (trimmedLine.startsWith('- ')) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }

      listItems.push(trimmedLine.slice(2))
      continue
    }

    flushList()
    blocks.push({ text: trimmedLine, type: 'p' })
  }

  flushList()

  return blocks
}

function renderInlineMarkdown(text: string) {
  const tokenPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g

  return text.split(tokenPattern).map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)

    if (linkMatch) {
      return (
        <a
          key={index}
          className="font-bold text-[#f3c316] underline-offset-4 hover:text-[#ffe07a] hover:underline"
          href={linkMatch[2]}
          rel="noreferrer"
          target="_blank"
        >
          {linkMatch[1]}
        </a>
      )
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded-md bg-[#080c1c] px-1.5 py-0.5 text-[#dfe8fb]">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }

    return part
  })
}
