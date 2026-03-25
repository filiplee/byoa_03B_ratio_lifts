import { useEffect, useMemo, useState } from 'react'
import { computeTargetRetestAt, writeRetestRecord } from '../hooks/useRetestState'

import type { RetestRecord } from '../hooks/useRetestState'
import type { FormEvent } from 'react'

interface RetestCaptureProps {
  open: boolean
  heroScore: number
  weakLift: string
  band: string
  previousLiftPercentiles?: Record<string, number>
  onCaptured: () => void
  onDismiss: () => void
}

export function RetestCapture({
  open,
  heroScore,
  weakLift,
  band,
  previousLiftPercentiles,
  onCaptured,
  onDismiss,
}: RetestCaptureProps) {
  const [email, setEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [visible, setVisible] = useState(false)

  const defaultPercentiles = useMemo(() => previousLiftPercentiles ?? {}, [previousLiftPercentiles])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setVisible(true), 1500)
    return () => window.clearTimeout(t)
  }, [open])

  const handleDismiss = () => {
    writeRetestRecord({ dismissed: true })
    onDismiss()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized) return

    const capturedAt = Date.now()
    const record: RetestRecord = {
      email: normalized,
      capturedAt,
      targetRetestAt: computeTargetRetestAt(capturedAt),
      heroScore,
      weakLift,
      band,
      previousScore: heroScore,
      previousRawPercentile: heroScore,
      previousBand: band,
      previousWeakLift: weakLift,
      previousLiftPercentiles: defaultPercentiles,
    }

    writeRetestRecord(record)
    setEmailSubmitted(true)
    setVisible(true)
    onCaptured()
  }

  return (
    <section className="mb-8">
      <div
        className={[
          'transition-all duration-500 ease-out',
          visible && open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
        ].join(' ')}
      >
        <div className="rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
          {emailSubmitted ? (
            <p className="text-sm font-medium text-[#e8c547]">
              Done. We&apos;ll see you in 6 weeks. In the meantime, your weak link is {weakLift} — you know what to
              do.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <p className="text-sm font-medium text-[#f5f2ec]">Want to know if you improved?</p>
                <p className="mt-2 text-sm text-[#a8a8a8]">Come back in 6 weeks and retest.</p>
                <p className="text-sm text-[#a8a8a8]">
                  We&apos;ll remind you — and show you exactly how much you moved.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2.5 text-sm text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-none border-none bg-[#5eead4] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#6af0de] focus:outline-none focus:ring-2 focus:ring-[#5eead4]/50"
                >
                  Set my retest reminder →
                </button>
              </div>

              <p className="text-[11px] text-[#555]">No spam. One email at 6 weeks.</p>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs font-light text-[#a8a8a8] underline hover:text-[#e8c547]"
                >
                  Maybe later
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

