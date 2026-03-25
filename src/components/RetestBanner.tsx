import type { RetestState } from '../hooks/useRetestState'
import { getBandFromHeroScore, updateRetestRecord } from '../hooks/useRetestState'

type ReadyRetestState = Extract<RetestState, { status: 'ready' }>

interface RetestBannerProps {
  state: ReadyRetestState
}

export function RetestBanner({ state }: RetestBannerProps) {
  const band = getBandFromHeroScore(state.previousScore)

  return (
    <section className="px-6 pt-4">
      <div className="rounded-none border border-[#2a2a2a] bg-[#111111] p-4 border-l-4 border-[#5eead4]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f5f2ec]">
              Welcome back.
              <br />
              Last time you were <span className="text-[#e8c547]">{band}</span> — {state.previousScore}th percentile.
              <br />
              Your weak link was <span className="text-[#e8e5df]">{state.previousWeakLift}</span>.
            </p>
            <p className="mt-2 text-sm text-[#a8a8a8]">
              Let's see where you are now. Enter your lifts below.
            </p>
          </div>

          <button
            type="button"
            aria-label="Dismiss retest banner"
            className="shrink-0 rounded-none border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1 text-xs text-[#a8a8a8] hover:text-[#e8c547]"
            onClick={() => {
              updateRetestRecord({ bannerConsumedAt: Date.now() })
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  )
}

