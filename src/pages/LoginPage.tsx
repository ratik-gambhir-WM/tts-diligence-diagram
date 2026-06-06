import { useState, type FormEvent } from 'react'

import { BrandLockup } from '../components/BrandLockup'
import { Button } from '../components/Button'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { Modal } from '../components/Modal'
import { PageShell } from '../components/PageShell'
import { StudioPanel } from '../components/StudioPanel'
import { TextField } from '../components/TextField'

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
      <PageShell layout="center">
        <StudioPanel className="w-full max-w-[520px]">
          <BrandLockup className="mb-8" title="Diligence Studio" />

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <TextField
              id="wm-email-local-part"
              name="wm-email-local-part"
              autoComplete="username"
              value={emailLocalPart}
              onChange={(event) => setEmailLocalPart(normalizeEmailLocalPart(event.target.value))}
              label="WM Email"
              placeholder="rgambhir"
              addon={emailDomain}
            />

            <TextField
              id="openai-api-key"
              name="openai-api-key"
              autoComplete="off"
              spellCheck={false}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              label="OpenAI API Key"
              placeholder="sk-..."
              help={
                <Button
                  type="button"
                  variant="link"
                  className="text-right text-[0.74rem]"
                  onClick={() => setIsApiKeyHelpOpen(true)}
                >
                  How do I get an OpenAI API Key?
                </Button>
              }
            />

            {error && <p className="text-[0.84rem] leading-5 text-[#ffb5b5]">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              className="mt-1 rounded-[1.15rem] px-5 py-3 text-[0.88rem] tracking-[0.14em]"
            >
              Continue
            </Button>
          </form>
        </StudioPanel>
      </PageShell>

      {isApiKeyHelpOpen && (
        <Modal
          labelledBy="api-key-help-title"
          title="OpenAI API Key"
          onClose={() => setIsApiKeyHelpOpen(false)}
        >
          <MarkdownRenderer markdown={apiKeyHelpMarkdown} />
        </Modal>
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
