import { useEffect, useState } from 'react'

const snailOffsets = [
  { delay: '0s', duration: '12s', top: 'calc(50% - 34px)' },
  { delay: '-4s', duration: '13.5s', top: '50%' },
  { delay: '-8s', duration: '15s', top: 'calc(50% + 30px)' },
]

export function SnailLoader() {
  const [dotCount, setDotCount] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDotCount((currentCount) => (currentCount + 1) % 4)
    }, 450)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <main className="snail-loader-screen" aria-busy="true" aria-live="polite">
      <section className="snail-loader-shell">
        <h1 className="snail-loader-kicker">
          Generating diagram
          <span className="snail-loader-dots" aria-hidden="true">
            {'.'.repeat(dotCount)}
          </span>
        </h1>
        <p className="snail-loader-copy">
          While you're waiting, enjoy the snail race below
        </p>
      </section>

      <div className="snail-stage" role="status" aria-label="Loading">
        <div className="snail-stage-line" aria-hidden="true" />

        {snailOffsets.map((snail, index) => (
          <div
            key={`${snail.delay}-${snail.duration}`}
            className="snail-runner"
            style={{
              animationDelay: snail.delay,
              animationDuration: snail.duration,
              top: snail.top,
            }}
          >
            <div className="snail">
              <div className="snail-shell">
                <div className="snail-shell-swirl" />
              </div>
              <div className="snail-body">
                <div className="snail-head">
                  <span className="snail-eye snail-eye-left" />
                  <span className="snail-eye snail-eye-right" />
                  <span className="snail-antenna snail-antenna-left" />
                  <span className="snail-antenna snail-antenna-right" />
                </div>
                <span className="snail-foot" />
              </div>
            </div>

            <span className="sr-only">Loading snail {index + 1}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
