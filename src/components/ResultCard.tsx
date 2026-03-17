import { useState } from 'react'
import type { FormState, DiagnosticResult, RatioFlagId } from '../types'
import { generateReportPDF } from '../pdf'
import { trackEvent } from '../analytics'
import { validateConsistency } from '../validation'
import {
  TYPICAL_RATIO_BW,
  FLAG_IMBALANCE_CALLOUT,
  getHeadlineDiagnosis,
  getIdealRangeForGoal,
  getPlainEnglishForRatio,
  getConfidenceReasons,
  computeBalanceScore,
} from '../calculations'
import { PercentileCurve } from './PercentileCurve'
import { StrengthRadarChart } from './StrengthRadarChart'

interface ResultCardProps {
  form: FormState
  result: DiagnosticResult
  coachMode?: boolean
  athleteName?: string
  coachNotes?: string
  coachName?: string
  onSaveScenario?: () => void
}

type FlagCategory = 'balanced' | 'lagging' | 'overdeveloped'

const LAGGING_FLAG_IDS: RatioFlagId[] = [
  'bench_lagging',
  'press_weak',
  'squat_lagging_bench',
  'bench_lagging_squat',
  'deadlift_lagging_bench',
  'bench_lagging_deadlift',
  'squat_lagging_press',
  'press_lagging_squat',
  'deadlift_lagging_press',
  'press_lagging_deadlift',
]

const OVERDEVELOPED_FLAG_IDS: RatioFlagId[] = [
  'bench_dominant',
  'deadlift_dominant',
  'squat_dominant',
  'press_strong',
]

function getFlagCategory(flagId: RatioFlagId): FlagCategory {
  if (flagId.startsWith('typical_')) return 'balanced'
  if (LAGGING_FLAG_IDS.includes(flagId)) return 'lagging'
  if (OVERDEVELOPED_FLAG_IDS.includes(flagId)) return 'overdeveloped'
  return 'lagging'
}

const ACCESSORY_PATTERN_MAP: Record<
  string,
  { exercise: string; pattern: string }
> = {
  'Pause Squat': {
    exercise: 'Pause Back Squat',
    pattern: 'Squat strength focus',
  },
  'Bulgarian Split Squat': {
    exercise: 'Bulgarian Split Squat',
    pattern: 'Lower-body volume focus',
  },
  'Box Squat': {
    exercise: 'Box Squat',
    pattern: 'Hip drive / posterior-chain focus',
  },
  'Incline Dumbbell Press': {
    exercise: 'Incline Dumbbell Press',
    pattern: 'Horizontal push volume',
  },
  'Cable Triceps Pushdown': {
    exercise: 'Cable Triceps Pushdown',
    pattern: 'Triceps / lockout focus',
  },
  'Deadlift Volume Sets': {
    exercise: 'Conventional Deadlift (volume sets)',
    pattern: 'Deadlift volume focus',
  },
  'Bench Press Volume Sets': {
    exercise: 'Bench Press (volume sets)',
    pattern: 'Horizontal push volume',
  },
}

export function ResultCard({ form, result, coachMode, onSaveScenario }: ResultCardProps) {
  const [assessmentDate] = useState(() => new Date())
  const [showConfidenceWhy, setShowConfidenceWhy] = useState(false)
  const [coachNotesLocal, setCoachNotesLocal] = useState('')
  const [email, setEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)

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
    generateReportPDF(form, result, {
      coachMode: !!coachMode,
      athleteName: form.athlete_name,
      coachName: form.coach_name,
      coachNotes: coachNotesLocal || undefined,
    })
  }

  const hasUserProvided = result.oneRMs.some((r) => r.method === 'user_provided')
  const liftPercentiles = result.liftPercentiles ?? []
  const top3 = result.accessories.slice(0, 3)
  const headline = getHeadlineDiagnosis(result.oneRMs, result.flags)
  const confidenceWhy = getConfidenceReasons({
    lifts: form.lifts,
    bodyweight: form.bodyweight,
    experience: form.experience,
    confidence: result.confidence,
  })

  const reminderDate = new Date(assessmentDate.getTime() + 28 * 24 * 60 * 60 * 1000)
  const reminderISO = reminderDate.toISOString().slice(0, 10)
  const reminderText = `Ratio Lifts retest: ${reminderISO}`
  const balanceScore = computeBalanceScore(result.ratios, result.flags, form.primary_goal)
  const balanceGrade =
    balanceScore >= 90 ? 'A' : balanceScore >= 80 ? 'B' : balanceScore >= 70 ? 'C' : balanceScore >= 60 ? 'D' : 'E'

  const getAccessoryDisplay = (name: string) => {
    const mapping = ACCESSORY_PATTERN_MAP[name]
    if (!mapping) {
      return {
        exercise: name,
        pattern: '',
      }
    }
    return mapping
  }

  const handleReminder = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: reminderText })
        return
      }
    } catch {
      /* ignore */
    }
    try {
      await navigator.clipboard.writeText(reminderText)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-xl border border-slate-500/50 bg-slate-600/50 p-6">
      <h2 className="mb-4 text-lg font-medium text-white">Your report</h2>

      {/* Primary diagnosis / main finding (hero card) */}
      <div className="mb-6 rounded-xl border border-teal-400/80 bg-gradient-to-r from-teal-500/20 via-slate-800/70 to-teal-500/10 p-4 shadow-lg">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-teal-200/90">
          Main finding
        </p>
        <p className="text-lg font-semibold text-slate-50 sm:text-2xl">
          {result.oneLineDiagnosis}
        </p>
        <p className="mt-2 text-sm text-slate-100/90 sm:text-base">
          {headline}
        </p>
        {form.primary_goal === 'Rehab' && (
          <p className="mt-3 text-xs text-slate-200/90">
            Rehab mode uses wider ranges — any flags are gentle cautions, not red alarms.
          </p>
        )}
      </div>

      {/* Strength profile radar chart */}
      {result.oneRMs.length > 0 && (
        <div className="mb-6">
          <StrengthRadarChart
            oneRMs={result.oneRMs}
            goal={form.primary_goal}
            bodyweight={form.bodyweight}
            units={form.units}
          />
        </div>
      )}

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
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  Balance Score
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  0–100 summary of how closely your key ratios sit inside their ideal ranges.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-teal-300">
                  {balanceScore}
                </div>
                <div className="text-xs font-medium text-slate-300">
                  Grade {balanceGrade}
                </div>
              </div>
            </div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-300">
              Ratios
            </h3>
            <div className="flex flex-wrap gap-3">
              {result.ratios.map((r) => {
                const flag = result.flags.find((f) => f.label === r.label)
                const idealForGoal = getIdealRangeForGoal(r.id, form.primary_goal)
                const ratioSentence = getPlainEnglishForRatio(r.id, r.value)
                const category: FlagCategory =
                  flag != null ? getFlagCategory(flag.id) : 'balanced'
                const imbalanceCallout =
                  flag && category !== 'balanced' ? FLAG_IMBALANCE_CALLOUT[flag.id] : null

                const badge =
                  category === 'balanced'
                    ? { text: '(balanced)', className: 'bg-teal-500/20 text-teal-200' }
                    : category === 'lagging'
                      ? { text: '(lagging)', className: 'bg-red-500/20 text-red-200' }
                      : { text: '(overdeveloped)', className: 'bg-amber-500/20 text-amber-200' }

                const ratioGaugeText = (() => {
                  if (!idealForGoal) return `Your ratio: ${r.value}`
                  const { min, max, rangeLabel } = idealForGoal
                  if (r.value < min) {
                    return `Your ratio: ${r.value} | Ideal: ${rangeLabel} | ↓ Below range`
                  }
                  if (r.value > max) {
                    return `Your ratio: ${r.value} | Ideal: ${rangeLabel} | ↑ Above range`
                  }
                  return `Your ratio: ${r.value} | Ideal: ${rangeLabel} | ✓ In range`
                })()

                const borderClass =
                  category === 'balanced'
                    ? 'border-teal-500/40'
                    : category === 'lagging'
                      ? 'border-red-500/50 bg-red-900/20'
                      : 'border-amber-500/50 bg-amber-900/20'

                const valueClass =
                  category === 'balanced'
                    ? 'text-teal-200'
                    : category === 'lagging'
                      ? 'text-red-300'
                      : 'text-amber-200'

                return (
                  <div
                    key={r.id}
                    className={`flex-1 min-w-[160px] rounded-lg border bg-slate-700/30 p-3 ${borderClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-200">
                        {r.label}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.text}
                      </span>
                    </div>
                    {imbalanceCallout && (
                      <p
                        className={`mt-1 text-[11px] font-medium ${
                          category === 'lagging'
                            ? 'text-red-300/90'
                            : 'text-amber-200/90'
                        }`}
                      >
                        {imbalanceCallout}
                      </p>
                    )}
                    <div className={`mt-1 text-sm font-semibold ${valueClass}`}>
                      {r.value}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-300">
                      {ratioGaugeText}
                    </p>
                    <p className="mt-1 text-xs font-light text-slate-200">
                      {ratioSentence}
                    </p>
                    {category !== 'balanced' && (
                      <p className="mt-0.5 text-[11px] text-slate-300">
                        {category === 'lagging'
                          ? 'A lagging ratio like this can hide weak links that cap your overall strength and push extra stress into nearby joints.'
                          : 'A dominant ratio like this often reflects technique gaps or muscle imbalances that can increase injury risk over time.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span
            title={confidenceWhy}
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
          <button
            type="button"
            title={confidenceWhy}
            onClick={() => {
              setShowConfidenceWhy((v) => !v)
              navigator.clipboard?.writeText(confidenceWhy)
            }}
            className="text-xs font-light text-slate-400 underline hover:text-teal-300"
          >
            Why?
          </button>
        </div>
        {showConfidenceWhy && (
          <p className="text-xs font-light text-slate-300">{confidenceWhy}</p>
        )}
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
                {(() => {
                  const display = getAccessoryDisplay(a.name)
                  return (
                    <>
                      <p className="text-sm font-semibold text-white">
                        {display.exercise}
                      </p>
                      {display.pattern && (
                        <p className="text-xs text-slate-300">
                          {display.pattern}
                        </p>
                      )}
                    </>
                  )
                })()}
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

      {/* Coach notes (coach mode only) */}
      {coachMode && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Coach notes <span className="text-slate-400">(included in PDF)</span>
          </label>
          <textarea
            value={coachNotesLocal}
            onChange={(e) => setCoachNotesLocal(e.target.value)}
            placeholder="Key cues, programming notes, next check-in…"
            rows={4}
            className="w-full rounded-lg border border-slate-500/50 bg-slate-700/50 px-4 py-3 text-sm font-light text-white placeholder:text-slate-400 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      )}

      {/* Save / progress tracking CTA */}
      <div className="mb-6 rounded-lg border border-slate-500/50 bg-slate-700/30 p-4">
        <p className="text-sm font-medium text-slate-100">Track your progress</p>
        <p className="mt-1 text-sm font-light text-slate-200">
          Come back in 4 weeks and re-enter your lifts to see how your ratios have shifted. Your imbalances typically respond within 2–3 training blocks.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleReminder}
            className="flex-1 rounded-lg border border-teal-500/40 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-200 hover:bg-teal-500/15"
          >
            Set a reminder (4 weeks)
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Reminder date: {reminderISO} (copied/shared when tapped).</p>
      </div>

      {/* Email capture for 8-week retest reminder */}
      <div className="mb-5 rounded-lg border border-slate-500/50 bg-slate-700/30 p-4">
        {!emailSubmitted ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!email.trim()) return
              console.log('Retest reminder email:', email.trim())
              setEmailSubmitted(true)
            }}
            className="space-y-3"
          >
            <p className="text-sm font-medium text-slate-100">
              Want a reminder to retest in 8 weeks? Drop your email below.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-500/60 bg-slate-800/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                required
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-teal-600/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-slate-700"
              >
                Get reminder
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              We’ll only use this to send a one-time reminder to re-test your ratios.
            </p>
          </form>
        ) : (
          <p className="text-sm font-medium text-teal-200">
            Got it — we&apos;ll remind you to retest in about 8 weeks.
          </p>
        )}
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
      {onSaveScenario && (
        <button
          type="button"
          onClick={onSaveScenario}
          className="mt-3 w-full rounded-lg border border-slate-500/60 bg-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-600/60"
        >
          Save this report
        </button>
      )}
    </div>
  )
}
