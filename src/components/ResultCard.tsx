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

  const primaryFlag = result.flags.find((f) => !f.id.startsWith('typical_'))
  const weakLinkLabel = primaryFlag?.label ?? result.oneRMs[0]?.name ?? 'Your profile'

  return (
    <div className="rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-6">
      {/* Hero result: verdict first, impossible to miss */}
      <section className="mb-8 border-b border-[#2a2a2a] pb-8">
        <p className="font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] tracking-[0.02em] text-[#f5f2ec]">
          YOUR WEAK LINK
        </p>
        <p className="mt-2 font-display text-[clamp(1.5rem,3vw,2rem)] tracking-[0.02em] text-[#e8c547]">
          {weakLinkLabel}
        </p>
        <p className="mt-3 text-lg font-medium text-[#e8e5df] sm:text-xl">
          {result.oneLineDiagnosis}
        </p>
        <p className="mt-2 text-[#a8a8a8] text-base">
          {headline}
        </p>
        {form.primary_goal === 'Rehab' && (
          <p className="mt-3 text-sm text-[#a8a8a8]">
            Rehab mode uses wider ranges — any flags are gentle cautions, not red alarms.
          </p>
        )}
      </section>

      {/* Email capture: directly below hero for maximum conversion */}
      <div className="mb-8 rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
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
            <p className="text-sm font-medium text-[#f5f2ec]">
              Want a reminder to retest in 8 weeks and track your progress?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2.5 text-sm text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
                required
              />
              <button
                type="submit"
                className="shrink-0 rounded-none border-none bg-[#e8c547] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#f5d76a] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/50"
              >
                Get reminder
              </button>
            </div>
            <p className="text-[11px] text-[#555]">
              We’ll only use this to send a one-time reminder to re-test your ratios.
            </p>
          </form>
        ) : (
          <p className="text-sm font-medium text-[#e8c547]">
            Got it — we&apos;ll remind you to retest in about 8 weeks.
          </p>
        )}
      </div>

      {/* Radar chart: second thing after hero */}
      {result.oneRMs.length > 0 && (
        <div className="mb-8">
          <StrengthRadarChart
            oneRMs={result.oneRMs}
            goal={form.primary_goal}
            bodyweight={form.bodyweight}
            units={form.units}
          />
        </div>
      )}

      {/* Main content: Graphs, 1RM, ratios */}
      <div className="mb-6 space-y-6">
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
            <div className="col-span-2 sm:col-span-4 rounded-none border border-dashed border-[#2a2a2a] bg-[#111111] p-4 text-center">
              <p className="text-sm text-[#555]">
                Add bodyweight to see distribution curves
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#a8a8a8]">
            Calculated 1RM
          </h3>
          <div className="overflow-hidden rounded-none border border-[#2a2a2a]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[#111111]">
                  <th className="px-4 py-2.5 text-left font-medium text-[#a8a8a8]">
                    Lift
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-[#a8a8a8]">
                    1RM ({form.units})
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.oneRMs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#2a2a2a] last:border-b-0"
                  >
                    <td className="px-4 py-2 font-light text-[#e8e5df]">{r.name}</td>
                    <td className="px-4 py-2 text-right font-medium text-[#f5f2ec]">
                      {r.oneRM}
                      {r.method === 'user_provided' && (
                        <span className="ml-1 text-xs text-[#555]">
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
            <p className="mt-2 text-xs text-[#555]">
              Estimated via Epley formula: 1RM = weight × (1 + reps/30)
            </p>
          )}
        </div>

        {result.ratios.length > 0 && (
          <div>
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-[#a8a8a8]">
                  Balance Score
                </h3>
                <p className="mt-0.5 text-[11px] text-[#555]">
                  0–100 summary of how closely your key ratios sit inside their ideal ranges.
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl text-[#e8c547]">
                  {balanceScore}
                </div>
                <div className="text-xs font-medium text-[#a8a8a8]">
                  Grade {balanceGrade}
                </div>
              </div>
            </div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#a8a8a8]">
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
                    ? { text: 'In range', className: 'bg-[rgba(74,124,89,0.2)] text-[#6fce8c] border border-[rgba(74,124,89,0.4)]' }
                    : category === 'lagging'
                      ? { text: 'Fix this', className: 'bg-[rgba(201,79,42,0.2)] text-[#e07a5f] border border-[rgba(201,79,42,0.4)]' }
                      : { text: 'Close', className: 'bg-[rgba(232,197,71,0.15)] text-[#e8c547] border border-[rgba(232,197,71,0.3)]' }

                const leftBorderClass =
                  category === 'balanced'
                    ? 'border-l-4 border-l-[#4a7c59]'
                    : category === 'lagging'
                      ? 'border-l-4 border-l-[#c94f2a]'
                      : 'border-l-4 border-l-[#e8c547]'

                const valueClass =
                  category === 'balanced'
                    ? 'text-[#6fce8c]'
                    : category === 'lagging'
                      ? 'text-[#e07a5f]'
                      : 'text-[#e8c547]'

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

                return (
                  <div
                    key={r.id}
                    className={`flex-1 min-w-[160px] rounded-none border border-[#2a2a2a] bg-[#111111] p-3 ${leftBorderClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-[#a8a8a8]">
                        {r.label}
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.text}
                      </span>
                    </div>
                    {imbalanceCallout && (
                      <p
                        className={`mt-1 text-[11px] font-medium ${
                          category === 'lagging'
                            ? 'text-[#e07a5f]'
                            : 'text-[#e8c547]'
                        }`}
                      >
                        {imbalanceCallout}
                      </p>
                    )}
                    <div className={`mt-1 text-sm font-semibold ${valueClass}`}>
                      {r.value}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#555]">
                      {ratioGaugeText}
                    </p>
                    <p className="mt-1 text-xs font-light text-[#a8a8a8]">
                      {ratioSentence}
                    </p>
                    {category !== 'balanced' && (
                      <p className="mt-0.5 text-[11px] text-[#555]">
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
            className={`rounded-none px-2 py-0.5 text-xs font-medium ${
              result.confidence === 'High'
                ? 'bg-[rgba(74,124,89,0.2)] text-[#6fce8c]'
                : result.confidence === 'Medium'
                  ? 'bg-[rgba(232,197,71,0.15)] text-[#e8c547]'
                  : 'bg-[rgba(201,79,42,0.2)] text-[#e07a5f]'
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
            className="text-xs font-light text-[#555] underline hover:text-[#e8c547]"
          >
            Why?
          </button>
        </div>
        {showConfidenceWhy && (
          <p className="text-xs font-light text-[#a8a8a8]">{confidenceWhy}</p>
        )}
      </div>

      {/* Top 3 recommendations */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-[#e8e5df]">
          Top 3 recommendations
        </h3>
        <ol className="space-y-3">
          {top3.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-none border border-[#2a2a2a] bg-[#111111] p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-[#e8c547] text-xs font-medium text-[#0a0a0a]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {a.forImbalance && (
                  <p className="text-xs font-medium text-[#e8c547]">
                    Addresses: {a.forImbalance}
                  </p>
                )}
                {(() => {
                  const display = getAccessoryDisplay(a.name)
                  return (
                    <>
                      <p className="text-sm font-semibold text-[#f5f2ec]">
                        {display.exercise}
                      </p>
                      {display.pattern && (
                        <p className="text-xs text-[#a8a8a8]">
                          {display.pattern}
                        </p>
                      )}
                    </>
                  )
                })()}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-light text-[#a8a8a8]">
                  <span>
                    <strong className="text-[#e8e5df]">{a.setsReps}</strong>
                  </span>
                  {a.suggestedWeight != null && (
                    <span>
                      <strong className="text-[#e8e5df]">
                        {a.suggestedWeight} {form.units}
                      </strong>
                      {' '}
                      suggested
                    </span>
                  )}
                </div>
                {a.cue && (
                  <p className="mt-1 text-xs text-[#555]">{a.cue}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-[#a8a8a8]">
          Add these to the end of your next 3 sessions. Come back in 4–8 weeks and retest — most people see meaningful ratio shifts in that window.
        </p>
      </div>

      {/* Coach notes (coach mode only) */}
      {coachMode && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-[#a8a8a8]">
            Coach notes <span className="text-[#555]">(included in PDF)</span>
          </label>
          <textarea
            value={coachNotesLocal}
            onChange={(e) => setCoachNotesLocal(e.target.value)}
            placeholder="Key cues, programming notes, next check-in…"
            rows={4}
            className="w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 text-sm font-light text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
          />
        </div>
      )}

      {/* Track your progress reminder */}
      <div className="mb-6 rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
        <p className="text-sm font-medium text-[#f5f2ec]">Track your progress</p>
        <p className="mt-1 text-sm font-light text-[#a8a8a8]">
          Come back in 4 weeks and re-enter your lifts to see how your ratios have shifted. Your imbalances typically respond within 2–3 training blocks.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleReminder}
            className="flex-1 rounded-none border border-[#e8c547]/40 bg-[#e8c547]/10 px-4 py-2.5 text-sm font-medium text-[#e8c547] hover:bg-[#e8c547]/15"
          >
            Set a reminder (4 weeks)
          </button>
        </div>
        <p className="mt-2 text-xs text-[#555]">Reminder date: {reminderISO} (copied/shared when tapped).</p>
      </div>

      {/* PDF export and Save: bottom, secondary */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#2a2a2a] pt-6">
        <button
          type="button"
          onClick={handleExport}
          className="text-sm font-medium text-[#a8a8a8] underline hover:text-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
        >
          Export PDF
        </button>
        {onSaveScenario && (
          <button
            type="button"
            onClick={onSaveScenario}
            className="rounded-none border border-[#2a2a2a] bg-transparent px-4 py-2 text-sm font-medium text-[#a8a8a8] hover:bg-[#2e2e2e]"
          >
            Save this report
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-[#555]">
        For information only — not medical advice. Use your head.
      </p>
    </div>
  )
}
