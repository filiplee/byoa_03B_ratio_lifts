import { useState } from 'react'
import { epley1RM } from '../calculations'
import type { LiftInput, LiftInputMethod, Units } from '../types'
import { displayToKg, kgToDisplay } from '../units'

interface LiftCardProps {
  lift: LiftInput
  units: Units
  bodyweight?: number
  onChange: (lift: LiftInput) => void
  hint?: string
}

export function LiftCard({ lift, units, bodyweight, onChange, hint }: LiftCardProps) {
  const [repsClampedFlash, setRepsClampedFlash] = useState(false)

  const isComplete =
    (lift.method === 'one_rm' && typeof lift.one_rm === 'number' && lift.one_rm > 0) ||
    (lift.method === 'weight_reps' &&
      typeof lift.weight === 'number' &&
      lift.weight > 0 &&
      typeof lift.reps === 'number' &&
      lift.reps >= 1 &&
      lift.reps <= 20)

  const warmupHint =
    bodyweight != null &&
    lift.method === 'weight_reps' &&
    typeof lift.reps === 'number' &&
    lift.reps > 10 &&
    typeof lift.weight === 'number' &&
    lift.weight < 0.5 * bodyweight
      ? 'Check input — is this a warmup?'
      : undefined
  const setMethod = (method: LiftInputMethod) => {
    if (method === 'one_rm') {
      // Pre-fill 1RM from entered weight×reps (if available).
      const weightKg = lift.weight
      const reps = lift.reps
      const computed =
        typeof weightKg === 'number' &&
        typeof reps === 'number' &&
        weightKg > 0 &&
        reps >= 1 &&
        reps <= 20
          ? epley1RM(weightKg, reps)
          : undefined

      return onChange({
        ...lift,
        method,
        one_rm: computed != null && computed > 0 ? computed : lift.one_rm,
      })
    }

    // Switching back preserves your previously-entered weight/reps values.
    return onChange({ ...lift, method })
  }
  const setWeight = (v: number | undefined) => onChange({ ...lift, weight: v })
  const setReps = (v: number | undefined) => onChange({ ...lift, reps: v })
  const setOneRM = (v: number | undefined) => onChange({ ...lift, one_rm: v })

  const oneRMHintText = 'Enter your tested or estimated one-rep max.'
  const effectiveHint =
    warmupHint ??
    (lift.method === 'weight_reps' ? hint : hint ? oneRMHintText : undefined)

  return (
    <div
      className={`rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-5 transition ${
        isComplete ? 'border-[#e8c547]/60 ring-1 ring-[#e8c547]/20' : ''
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#f5f2ec]">{lift.name}</h3>
        {isComplete && (
          <span className="rounded-none bg-[rgba(74,124,89,0.2)] px-2 py-1 text-[11px] font-medium text-[#6fce8c] border border-[rgba(74,124,89,0.4)]">
            ✓ Complete
          </span>
        )}
      </div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod('weight_reps')}
          className={`rounded-none px-3 py-2 text-sm font-medium ${lift.method === 'weight_reps' ? 'bg-[#e8c547] text-[#0a0a0a]' : 'bg-[#111111] text-[#b0b0b0] border border-[#2a2a2a] hover:bg-[#2e2e2e]'}`}
        >
          Weight × Reps
        </button>
        <button
          type="button"
          onClick={() => setMethod('one_rm')}
          className={`rounded-none px-3 py-2 text-sm font-medium ${lift.method === 'one_rm' ? 'bg-[#e8c547] text-[#0a0a0a]' : 'bg-[#111111] text-[#b0b0b0] border border-[#2a2a2a] hover:bg-[#2e2e2e]'}`}
        >
          1RM
        </button>
      </div>
      {lift.method === 'weight_reps' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${lift.id}-weight`} className="mb-1 block text-xs text-[#b0b0b0]">
              Weight ({units})
            </label>
            <input
              id={`${lift.id}-weight`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder="0"
              value={lift.weight == null ? '' : kgToDisplay(lift.weight, units)}
              onChange={(e) => {
                if (e.target.value === '') {
                  setWeight(undefined)
                  return
                }
                const kg = displayToKg(Number(e.target.value), units)
                setWeight(Math.max(0, kg))
              }}
              className="w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#b0b0b0] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
            />
            {typeof lift.weight === 'number' && lift.weight > 500 && (
              <p className="mt-1 text-[11px] text-[#e07a5f]">That looks unusual — double-check your entry.</p>
            )}
          </div>
          <div>
            <label htmlFor={`${lift.id}-reps`} className="mb-1 block text-xs text-[#b0b0b0]">
              Reps (1–20)
            </label>
            <input
              id={`${lift.id}-reps`}
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              placeholder="0"
              value={lift.reps ?? ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setReps(undefined)
                  return
                }
                const raw = Number(e.target.value)
                const clamped = Math.max(1, Math.min(20, raw))
                const didClamp = clamped !== raw
                setReps(clamped)
                if (didClamp) {
                  setRepsClampedFlash(true)
                  window.setTimeout(() => setRepsClampedFlash(false), 650)
                }
              }}
              className={`w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#b0b0b0] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30 ${
                repsClampedFlash ? 'ring-2 ring-[#e07a5f]/30' : ''
              }`}
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor={`${lift.id}-onerm`} className="mb-1 block text-xs text-[#b0b0b0]">
            1RM ({units})
          </label>
          <input
            id={`${lift.id}-onerm`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            placeholder="0"
            value={lift.one_rm == null ? '' : kgToDisplay(lift.one_rm, units)}
            onChange={(e) => {
              if (e.target.value === '') {
                setOneRM(undefined)
                return
              }
              const kg = displayToKg(Number(e.target.value), units)
              setOneRM(Math.max(0, kg))
            }}
            className="w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 font-light text-[#f5f2ec] placeholder:text-[#b0b0b0] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
          />
          {typeof lift.one_rm === 'number' && lift.one_rm > 500 && (
            <p className="mt-1 text-[11px] text-[#e07a5f]">That looks unusual — double-check your entry.</p>
          )}
        </div>
      )}
      {effectiveHint && <p className="mt-2 text-xs text-[#b0b0b0]">{effectiveHint}</p>}
    </div>
  )
}
