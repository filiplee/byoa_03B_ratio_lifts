import type { FormState, DiagnosticResult, RatioFlagId } from '../types'
import { generateReportPDF } from '../pdf'
import { trackEvent } from '../analytics'
import { validateConsistency } from '../validation'
import { TYPICAL_RATIO_BW, IDEAL_RATIOS, FLAG_IMBALANCE_CALLOUT } from '../calculations'
import { PercentileCurve } from './PercentileCurve'

interface ResultCardProps {
  form: FormState
  result: DiagnosticResult
}

// Flag IDs that indicate deficient or overly strong (imbalance) — highlight in red
const RED_FLAG_IDS: RatioFlagId[] = [
  'bench_lagging',
  'press_weak',
  'bench_dominant',
  'deadlift_dominant',
  'squat_dominant',
  'press_strong',
  // Lower-to-upper cross-body
  'squat_lagging_bench',
  'bench_lagging_squat',
  'deadlift_lagging_bench',
  'bench_lagging_deadlift',
  'squat_lagging_press',
  'press_lagging_squat',
  'deadlift_lagging_press',
  'press_lagging_deadlift',
]

function isProblematicFlag(flagId: string): boolean {
  return RED_FLAG_IDS.includes(flagId as RatioFlagId)
}

export function ResultCard({ form, result }: ResultCardProps) {
  const handleExport = () => {
    validateConsistency(
      {
        lifts: form.lifts,
        bodyweight: form.bodyweight,
        experience: form.experience,
        units: form.units,
        injury: form.injury,
        injury_notes: form.injury_notes,
      },
      result
    )
    trackEvent('pdf_export')
    generateReportPDF(form, result)
  }

  const hasUserProvided = result.oneRMs.some((r) => r.method === 'user_provided')
  const liftPercentiles = result.liftPercentiles ?? []
  const top3 = result.accessories.slice(0, 3)

  return (
    <div className="rounded-xl border border-slate-500/50 bg-slate-600/50 p-6">
      <h2 className="mb-5 text-lg font-medium text-white">Your report</h2>

      {/* Main content: Graphs first (horizontal), then 1RM, then ratios (horizontal) */}
      <div className="mb-6 space-y-6">
        {/* 1. Graphs horizontal first — wider grid so charts don't overlap */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 min-w-0">
          {liftPercentiles.length > 0 ? (
            liftPercentiles.map((lp) => (
              <div key={lp.id} className="min-w-0">
                <PercentileCurve
                  liftName={lp.name}
                  ratioBW={lp.ratioBW}
                  percentile={lp.percentile}
                  typicalRatio={TYPICAL_RATIO_BW[lp.id] ?? 1}
                />
              </div>
            ))
          ) : (
            <div className="col-span-2 sm:col-span-4 rounded-lg border border-dashed border-slate-500/50 bg-slate-700/30 p-4 text-center">
              <p className="text-sm text-slate-400">
                Add bodyweight to see distribution curves
              </p>
            </div>
          )}
        </div>

        {/* 2. 1RM estimates */}
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-300">
            Calculated 1RM
          </h3>
          <div className="overflow-hidden rounded-lg border border-slate-500/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-500/50 bg-slate-700/50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-200">
                    Lift
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-200">
                    1RM ({form.units})
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.oneRMs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-500/30 last:border-b-0"
                  >
                    <td className="px-4 py-2 font-light text-slate-200">{r.name}</td>
                    <td className="px-4 py-2 text-right font-medium text-white">
                      {r.oneRM}
                      {r.method === 'user_provided' && (
                        <span className="ml-1 text-xs text-slate-400">
                          (provided)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasUserProvided && (
            <p className="mt-2 text-xs text-slate-400">
              Estimated via Epley formula: 1RM = weight × (1 + reps/30)
            </p>
          )}
        </div>

        {/* 3. Ratios horizontal (cards side by side) */}
        {result.ratios.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-300">
              Ratios
            </h3>
            <div className="flex flex-wrap gap-3">
              {result.ratios.map((r) => {
                const flag = result.flags.find((f) => f.label === r.label)
                const isRed = flag && isProblematicFlag(flag.id)
                const imbalanceCallout = flag && isRed ? FLAG_IMBALANCE_CALLOUT[flag.id] : null
                const idealInfo = IDEAL_RATIOS[r.id]
                const ideal = idealInfo?.ideal ?? '—'
                const range = idealInfo?.range ?? '—'
                return (
                  <div
                    key={r.id}
                    className={`flex-1 min-w-[140px] rounded-lg border border-slate-500/50 bg-slate-700/30 p-3 ${
                      isRed ? 'border-red-500/50 bg-red-900/20' : ''
                    }`}
                  >
                    <div
                      className={`text-xs font-medium ${isRed ? 'text-red-300' : 'text-slate-200'}`}
                    >
                      {r.label}
                      {isRed && (
                        <span className="ml-1 text-red-400">(imbalance)</span>
                      )}
                    </div>
                    {imbalanceCallout && (
                      <p className="mt-1 text-xs font-medium text-red-300/90">
                        {imbalanceCallout}
                      </p>
                    )}
                    <div
                      className={`mt-1 text-sm font-medium ${isRed ? 'text-red-300' : 'text-white'}`}
                    >
                      {r.value}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Ideal {ideal} · {range}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              result.confidence === 'High'
                ? 'bg-teal-500/20 text-teal-300'
                : result.confidence === 'Medium'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-red-500/20 text-red-300'
            }`}
          >
            Confidence: {result.confidence}
          </span>
        </div>
      </div>

      {/* Diagnosis callout */}
      <div className="mb-6 rounded-lg border border-teal-500/40 bg-teal-500/10 p-4">
        <p className="text-sm font-medium text-slate-100">
          {result.oneLineDiagnosis}
        </p>
      </div>

      {/* Bottom: Top 3 recommendations with sets, reps, weights */}
      <div className="mb-5">
        <h3 className="mb-3 text-sm font-medium text-slate-200">
          Top 3 recommendations
        </h3>
        <ol className="space-y-3">
          {top3.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-slate-500/50 bg-slate-700/30 p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600/80 text-xs font-medium text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {a.forImbalance && (
                  <p className="text-xs font-medium text-teal-300/90">
                    Addresses: {a.forImbalance}
                  </p>
                )}
                <span className="font-medium text-white">{a.name}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-light text-slate-300">
                  <span>
                    <strong className="text-slate-200">{a.setsReps}</strong>
                  </span>
                  {a.suggestedWeight != null && (
                    <span>
                      <strong className="text-slate-200">
                        {a.suggestedWeight} {form.units}
                      </strong>
                      {' '}
                      suggested
                    </span>
                  )}
                </div>
                {a.cue && (
                  <p className="mt-1 text-xs text-slate-400">{a.cue}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="mb-4 text-xs text-slate-400">
        Informational only — not medical advice. Consult a professional for
        injuries.
      </p>

      <button
        type="button"
        onClick={handleExport}
        className="w-full rounded-lg bg-teal-600/80 px-4 py-3 font-medium text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-slate-600"
      >
        Export PDF
      </button>
    </div>
  )
}
