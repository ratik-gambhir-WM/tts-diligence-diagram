import { useEffect, useState } from 'react'

import { WestMonroeMark } from './WestMonroeMark'

const snailClasses = [
  'snail-loader-runner-one',
  'snail-loader-runner-two',
  'snail-loader-runner-three',
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
  'An inspector with a magnifying glass...',
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
      className="snail-loader"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="snail-loader-intro">
        <div className="snail-loader-mark-shell">
          <WestMonroeMark className="snail-loader-mark" />
        </div>
        <p
          key={loadingPhrases[phraseIndex]}
          className="snail-loader-phrase"
        >
          {loadingPhrases[phraseIndex]}
        </p>
      </section>

      <div className="snail-loader-track" role="status" aria-label="Loading">
        <div
          className="snail-loader-track-line"
          aria-hidden="true"
        />

        {snailClasses.map((snail, index) => (
          <div
            key={snail}
            className={`snail-loader-runner ${snail}`}
          >
            <div className="snail-loader-snail">
              <div className="snail-loader-shell">
                <div className="snail-loader-shell-spiral" />
              </div>
              <div className="snail-loader-body">
                <div className="snail-loader-head">
                  <span className="snail-loader-eye snail-loader-eye-left" />
                  <span className="snail-loader-eye snail-loader-eye-right" />
                  <span className="snail-loader-antenna snail-loader-antenna-left" />
                  <span className="snail-loader-antenna snail-loader-antenna-right" />
                </div>
                <span className="snail-loader-foot" />
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
