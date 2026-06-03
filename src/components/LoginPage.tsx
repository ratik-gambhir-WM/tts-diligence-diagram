import { useState, type FormEvent } from 'react'

import { WestMonroeMark } from './WestMonroeMark'

type LoginPageProps = {
  initialEmailLocalPart?: string
  onSubmit: (credentials: { email: string }) => void
}

const emailDomain = '@westmonroe.com'

export function LoginPage({ initialEmailLocalPart = '', onSubmit }: LoginPageProps) {
  const [emailLocalPart, setEmailLocalPart] = useState(initialEmailLocalPart)
  const [error, setError] = useState('')

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
    <main className="grid min-h-screen place-items-center bg-[#070a1b] px-6 py-8 text-[#eef3ff]">
      <section className="relative w-full max-w-[520px] overflow-hidden border border-white/12 bg-[#0b0f24] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
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
                Diagram Studio
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">west monroe</h1>
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
              <div className="flex overflow-hidden border border-[#28304a] bg-[#080c1c] focus-within:border-[#dfe8fb]">
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

            {error && <p className="text-[0.84rem] leading-5 text-[#ffb5b5]">{error}</p>}

            <button
              type="submit"
              className="mt-1 cursor-pointer border border-[#f3c316] bg-[#f3c316] px-5 py-3 text-[0.88rem] font-bold tracking-[0.14em] text-[#070a1b] uppercase transition hover:brightness-105"
            >
              Continue
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

function normalizeEmailLocalPart(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/@westmonroe\.com$/i, '')
    .replace(/@.*/, '')
}
