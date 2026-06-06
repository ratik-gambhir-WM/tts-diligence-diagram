import { useEffect, useState } from 'react'

import { WestMonroeMark } from './WestMonroeMark'

const snailOffsets = [
  { delay: '0s', duration: '12s', top: 'calc(50% - 34px)' },
  { delay: '-4s', duration: '13.5s', top: '50%' },
  { delay: '-8s', duration: '15s', top: 'calc(50% + 30px)' },
]

const loadingPhrases = [
  'Checking if Kubernetes is the strategy...',
  'Looking for the database everyone shares...',
  'Asking why the auth service knows everything...',
  'Detecting whether Kafka is being used as therapy...',
  'Seeing if the cache is now the source of truth...',
  'Wondering why production is named "final-final-v2"...',
  'Confirming whether the API gateway is actually a gateway...',
  'Finding the cron job holding the company together...',
  'Checking if the ETL pipeline has feelings...',
  'Seeing if observability means "we check logs sometimes"...',
  'Looking for the Excel file in the critical path...',
  'Identifying which service became a lifestyle...',
  'Determining if "event-driven" means "we hope events arrive"...',
  'Asking the legacy system to please be cool...',
  'Checking if the staging environment is decorative...',
  'Finding the Lambda nobody remembers deploying...',
  'Seeing whether the data lake has become a data swamp...',
  'Determining if the diagram matches production...',
  'Looking for hardcoded secrets and soft commitments...',
  'Checking whether "temporary" is older than the company...',
  'Mapping the spaghetti...',
  'Finding the hidden monolith...',
  'Looking for surprise dependencies...',
  'Interviewing the boxes and arrows...',
  'Asking the architecture diagram what it is hiding...',
  'Checking whether "microservices" means "distributed monolith"...',
  'Following the data flows into the basement...',
  'Looking for the system nobody owns...',
  'Translating whiteboard chaos into diligence-ready insight...',
  'Separating architecture from aspiration...',
  'Counting integrations and regretting it...',
  'Looking for the single point of "oh no"...',
  'Checking if the roadmap is doing load-bearing work...',
  'Finding where scalability goes to die...',
  'Detecting tactical duct tape...',
  'Verifying whether the platform is actually a platform...',
  'Turning tribal knowledge into diagram labels...',
  'Looking for the service named "misc"...',
  'Inspecting the blast radius...',
  'Checking if "cloud-native" survived contact with reality...',
]

export function SnailLoader() {
  const [phraseIndex, setPhraseIndex] = useState(() => randomPhraseIndex())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPhraseIndex((currentIndex) => randomPhraseIndex(currentIndex))
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <main
      className="grid min-h-screen content-center justify-items-center gap-9 bg-[#070a1b] p-8 text-[#eef3ff] max-[640px]:gap-7 max-[640px]:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="w-full max-w-[48rem] text-center">
        <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full border border-white/12 bg-[#0b0f24] shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
          <WestMonroeMark className="h-14 w-14 [animation:loader-mark-spin_1.2s_linear_infinite] [&_rect]:fill-[#f3c316]" />
        </div>
        <p
          key={loadingPhrases[phraseIndex]}
          className="loader-phrase mx-auto mt-[0.9rem] min-h-[3rem] max-w-[42rem] text-base leading-6 text-[#a8afc4]"
        >
          {loadingPhrases[phraseIndex]}
        </p>
      </section>

      <div className="relative h-[17rem] w-[min(100vw,78rem)] overflow-hidden max-[640px]:h-[13.5rem]" role="status" aria-label="Loading">
        <div
          className="absolute top-1/2 right-0 left-0 h-[2px] -translate-y-1/2 bg-[linear-gradient(90deg,rgba(243,195,22,0),rgba(243,195,22,0.2)_12%,rgba(243,195,22,0.2)_88%,rgba(243,195,22,0)),linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.1))]"
          aria-hidden="true"
        />

        {snailOffsets.map((snail, index) => (
          <div
            key={`${snail.delay}-${snail.duration}`}
            className="absolute left-0 will-change-transform [animation-iteration-count:infinite] [animation-name:snail-cross] [animation-timing-function:linear]"
            style={{
              animationDelay: snail.delay,
              animationDuration: snail.duration,
              top: snail.top,
            }}
          >
            <div className="relative flex items-end gap-2 [animation:snail-bob_1.5s_ease-in-out_infinite] after:absolute after:bottom-[-0.05rem] after:left-[1.7rem] after:h-[0.35rem] after:w-[5rem] after:rounded-full after:bg-[linear-gradient(90deg,rgba(242,111,33,0.08),rgba(242,111,33,0.38))] after:[animation:snail-trail_1.8s_ease-in-out_infinite] after:[transform-origin:left_center] after:content-['']">
              <div className="relative h-[3.9rem] w-[3.9rem] rounded-full border-[3px] border-[rgba(123,61,19,0.9)] bg-[radial-gradient(circle_at_34%_35%,#ffe0bc_0_18%,transparent_19%),radial-gradient(circle_at_68%_68%,rgba(118,66,24,0.18)_0_20%,transparent_21%),linear-gradient(145deg,#f3b074_0%,#e68b4f_55%,#c56024_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_20px_rgba(201,85,24,0.18)]">
                <div className="absolute inset-[0.72rem] rounded-full border-[3px] border-[rgba(123,61,19,0.9)] after:absolute after:inset-[0.55rem] after:rounded-full after:border-[3px] after:border-[rgba(123,61,19,0.9)] after:border-b-transparent after:border-l-transparent after:content-['']" />
              </div>
              <div className="relative h-[2.4rem] w-[5.6rem] rounded-[1.8rem_2rem_0.9rem_1.1rem] border-[3px] border-[rgba(123,61,19,0.9)] border-l-[2px] bg-[linear-gradient(180deg,#ffd3a6_0%,#f1aa62_100%)]">
                <div className="absolute top-[-0.9rem] right-[-0.1rem] h-[1.75rem] w-[1.75rem] rounded-full border-[3px] border-[rgba(123,61,19,0.9)] bg-[linear-gradient(180deg,#ffd9b4_0%,#efac63_100%)]">
                  <span className="absolute top-[0.48rem] left-[0.48rem] h-[0.22rem] w-[0.22rem] rounded-full bg-[#171717]" />
                  <span className="absolute top-[0.48rem] right-[0.48rem] h-[0.22rem] w-[0.22rem] rounded-full bg-[#171717]" />
                  <span className="absolute top-[-0.72rem] left-[0.45rem] h-[0.85rem] w-[0.13rem] rotate-[-16deg] rounded-full bg-[rgba(123,61,19,0.95)] after:absolute after:top-[-0.16rem] after:left-1/2 after:h-[0.28rem] after:w-[0.28rem] after:-translate-x-1/2 after:rounded-full after:bg-[rgba(123,61,19,0.95)] after:content-['']" />
                  <span className="absolute top-[-0.72rem] right-[0.45rem] h-[0.85rem] w-[0.13rem] rotate-[16deg] rounded-full bg-[rgba(123,61,19,0.95)] after:absolute after:top-[-0.16rem] after:left-1/2 after:h-[0.28rem] after:w-[0.28rem] after:-translate-x-1/2 after:rounded-full after:bg-[rgba(123,61,19,0.95)] after:content-['']" />
                </div>
                <span className="absolute right-[0.25rem] bottom-[-0.35rem] left-[0.25rem] h-[0.55rem] rounded-b-full bg-[rgba(123,61,19,0.2)]" />
              </div>
            </div>

            <span className="sr-only">Loading snail {index + 1}</span>
          </div>
        ))}
      </div>
    </main>
  )
}

function randomPhraseIndex(currentIndex?: number) {
  if (loadingPhrases.length <= 1) {
    return 0
  }

  let nextIndex = Math.floor(Math.random() * loadingPhrases.length)
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * loadingPhrases.length)
  }
  return nextIndex
}
