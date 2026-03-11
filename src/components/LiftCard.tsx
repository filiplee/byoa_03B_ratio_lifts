import type { LiftInput, LiftInputMethod, Units } from '../types'

interface LiftCardProps {
  lift: LiftInput
  units: Units
  bodyweight?: number
  onChange: (lift: LiftInput) => void
  hint?: string
}

export function LiftCard({ lift, units, bodyweight, onChange, hint }: LiftCardProps) {
  const warmupHint =
    bodyweight != null &&
    lift.method === 'weight_reps' &&
    typeof lift.reps === 'number' &&
    lift.reps > 10 &&
    typeof lift.weight === 'number' &&
    lift.weight < 0.5 * bodyweight
      ? 'Check input — is this a warmup?'
      : undefined
  const setMethod = (method: LiftInputMethod) => onChange({ ...lift, method })
  const setWeight = (v: number | undefined) => onChange({ ...lift, weight: v })
  const setReps = (v: number | undefined) => onChange({ ...lift, reps: v })
  const setOneRM = (v: number | undefined) => onChange({ ...lift, one_rm: v })

  return (
    <div className="rounded-xl border border-slate-500/50 bg-slate-600/50 p-5">
      <h3 className="mb-4 text-sm font-medium text-white">{lift.name}</h3>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod('weight_reps')}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${lift.method === 'weight_reps' ? 'bg-teal-600/80 text-white' : 'bg-slate-500/50 text-slate-200 hover:bg-slate-500/70'}`}
        >
          Weight × Reps
        </button>
        <button
          type="button"
          onClick={() => setMethod('one_rm')}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${lift.method === 'one_rm' ? 'bg-teal-600/80 text-white' : 'bg-slate-500/50 text-slate-200 hover:bg-slate-500/70'}`}
        >
          1RM
        </button>
      </div>
      {lift.method === 'weight_reps' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${lift.id}-weight`} className="mb-1 block text-xs text-slate-300">
              Weight ({units})
            </label>
            <input
              id={`${lift.id}-weight`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder="0"
              value={lift.weight ?? ''}
              onChange={(e) => setWeight(e.target.value === '' ? undefined : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-4 py-3 font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
          <div>
            <label htmlFor={`${lift.id}-reps`} className="mb-1 block text-xs text-slate-300">
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
              onChange={(e) => setReps(e.target.value === '' ? undefined : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-4 py-3 font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor={`${lift.id}-onerm`} className="mb-1 block text-xs text-slate-300">
            1RM ({units})
          </label>
          <input
            id={`${lift.id}-onerm`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            placeholder="0"
            value={lift.one_rm ?? ''}
            onChange={(e) => setOneRM(e.target.value === '' ? undefined : Number(e.target.value))}
            className="w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-4 py-3 font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      )}
      {(hint || warmupHint) && (
        <p className="mt-2 text-xs text-slate-400">{warmupHint ?? hint}</p>
      )}
    </div>
  )
}
