import { useEffect, useState, type FormEvent } from 'react'
import type { FormState, DiagnosticResult, RatioFlagId } from '../types'
import { LIFT_NAMES } from '../types'
import { generateReportPDF } from '../pdf'
import { trackEvent } from '../analytics'
import { validateConsistency } from '../validation'
import { formatKg } from '../units'
import {
  computeDaysSince,
  computeTargetRetestAt,
  getBandFromHeroScore,
  readRetestRecord,
  RETEST_UPDATE_EVENT,
  writeRetestRecord,
} from '../hooks/useRetestState'
import {
  FLAG_IMBALANCE_CALLOUT,
  getIdealRangeForGoal,
  getHeadlineDiagnosis,
  getPlainEnglishForRatio,
  computeBalanceScore,
  getLiftP50TypicalRatio,
} from '../calculations'
import { PercentileCurve } from './PercentileCurve'
import { StrengthRadarChart } from './StrengthRadarChart'
import { ScoreComparison } from './ScoreComparison'

interface ResultCardProps {
  form: FormState
  result: DiagnosticResult
  coachMode?: boolean
  athleteName?: string
  coachNotes?: string
  coachName?: string
  onSaveScenario?: () => Promise<void> | void
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

const TOP_RATIO_IDS = ['bench_to_squat', 'squat_to_deadlift', 'press_to_bench', 'squat_to_bench'] as const

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
  const [showAllRatios, setShowAllRatios] = useState(false)
  const [coachNotesLocal, setCoachNotesLocal] = useState('')
  const [retestRecord, setRetestRecord] = useState(() => readRetestRecord())
  const [prescriptionEmail, setPrescriptionEmail] = useState<string | null>(() => {
    const rec = readRetestRecord()
    return typeof rec?.email === 'string' && rec.email.trim().length > 0 ? rec.email : null
  })
  const [emailInput, setEmailInput] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pdfExportBusy, setPdfExportBusy] = useState(false)
  const [saveLinkBusy, setSaveLinkBusy] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistBusy, setWaitlistBusy] = useState(false)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    const onUpdate = () => setRetestRecord(readRetestRecord())
    window.addEventListener(RETEST_UPDATE_EVENT, onUpdate)
    return () => window.removeEventListener(RETEST_UPDATE_EVENT, onUpdate)
  }, [])

  useEffect(() => {
    if (prescriptionEmail) setWaitlistEmail(prescriptionEmail)
  }, [prescriptionEmail])

  const handleJoinWaitlist = (e: FormEvent) => {
    e.preventDefault()
    if (waitlistBusy) return
    const normalized = waitlistEmail.trim().toLowerCase()
    if (!normalized) return

    setWaitlistBusy(true)
    try {
      // MVP: store locally; no external API.
      localStorage.setItem('mls_waitlist_email', normalized)
      showToast('You’re on the waitlist. We’ll email you when beta opens.')
    } finally {
      setWaitlistBusy(false)
    }
  }

  const handleExport = async () => {
    if (pdfExportBusy) return
    setPdfExportBusy(true)
    showToast('Generating PDF…')
    try {
      validateConsistency(
        {
          lifts: form.lifts,
          bodyweight: form.bodyweight,
          experience: form.experience,
          gender: form.gender,
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
      await new Promise((r) => window.setTimeout(r, 350))
      showToast('PDF downloaded.')
    } catch {
      await new Promise((r) => window.setTimeout(r, 350))
      showToast('PDF export coming soon')
    } finally {
      setPdfExportBusy(false)
    }
  }

  const hasUserProvided = result.oneRMs.some((r) => r.method === 'user_provided')
  const liftPercentiles = result.liftPercentiles ?? []
  const top3 = result.accessories.slice(0, 3)
  const cueFallback = 'Smooth reps with controlled tempo.'
  const commonForImbalance =
    top3.length > 0 &&
    top3.every((a) => typeof a.forImbalance === 'string') &&
    top3.every((a) => a.forImbalance === top3[0]?.forImbalance)
      ? (top3[0]?.forImbalance as string)
      : null
  const recommendationHeader = top3.length === 2 ? 'Top 2 recommendations' : 'Top 3 recommendations'
  const recommendationFooterText =
    form.training_frequency === '1-2'
      ? 'Add these to the end of your existing sessions. Come back in 4-8 weeks and retest - most people see meaningful ratio shifts in that window.'
      : form.training_frequency === '3-4'
        ? 'Add these to the end of your next 3 sessions. Come back in 4-8 weeks and retest - most people see meaningful ratio shifts in that window.'
        : 'Schedule one dedicated corrective session, then come back in 4-8 weeks and retest - most people see meaningful ratio shifts in that window.'

  const heroScoreValue = result.heroScore.displayedScore
  const heroBand = result.heroScore.band

  const heroWeakLiftId = result.heroScore.weakestLift
  const penaltyPoints = result.heroScore.penaltyPoints
  const rawPercentile = result.heroScore.rawPercentile

  const RETEST_WEEKS = 8
  const reminderDate = new Date(assessmentDate.getTime() + RETEST_WEEKS * 7 * 24 * 60 * 60 * 1000)
  const reminderISO = reminderDate.toISOString().slice(0, 10)
  const reminderText = `Ratio Lifts retest: ${reminderISO}`
  const balanceScore = computeBalanceScore(result.ratios, result.flags, form.primary_goal)
  const balanceGrade =
    balanceScore >= 90 ? 'A' : balanceScore >= 80 ? 'B' : balanceScore >= 70 ? 'C' : balanceScore >= 60 ? 'D' : 'E'

  const hasHiddenRatios = result.ratios.some(
    (r) => !TOP_RATIO_IDS.includes(r.id as (typeof TOP_RATIO_IDS)[number]),
  )
  const visibleRatios = showAllRatios
    ? result.ratios
    : result.ratios.filter((r) => TOP_RATIO_IDS.includes(r.id as (typeof TOP_RATIO_IDS)[number]))

  const daysSinceCaptured = computeDaysSince(retestRecord?.capturedAt) ?? null
  const shouldShowScoreComparison =
    retestRecord != null &&
    retestRecord.dismissed !== true &&
    typeof retestRecord.previousScore === 'number' &&
    typeof retestRecord.previousWeakLift === 'string' &&
    daysSinceCaptured != null &&
    daysSinceCaptured >= 50

  const previousScore =
    retestRecord != null && typeof retestRecord.previousScore === 'number' ? retestRecord.previousScore : null
  const previousWeakLift =
    retestRecord != null && typeof retestRecord.previousWeakLift === 'string' ? retestRecord.previousWeakLift : null
  const previousBand =
    retestRecord != null && typeof retestRecord.previousBand === 'string'
      ? retestRecord.previousBand
      : previousScore != null
        ? getBandFromHeroScore(previousScore)
        : null

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

  const handleGetPrescription = (e: FormEvent) => {
    e.preventDefault()
    if (emailBusy) return
    const normalized = emailInput.trim().toLowerCase()
    if (!normalized) return

    setEmailBusy(true)
    try {
      const capturedAt = Date.now()
      const targetRetestAt = computeTargetRetestAt(capturedAt)
      const previousLiftPercentiles = liftPercentiles.reduce<Record<string, number>>((acc, lp) => {
        acc[lp.id] = lp.percentile
        return acc
      }, {})

      writeRetestRecord({
        email: normalized,
        capturedAt,
        targetRetestAt,
        heroScore: heroScoreValue,
        weakLift: currentWeakLift,
        band: heroBand,

        previousScore: heroScoreValue,
        previousRawPercentile: heroScoreValue,
        previousBand: heroBand,
        previousWeakLift: currentWeakLift,
        previousLiftPercentiles: previousLiftPercentiles,
      })

      setPrescriptionEmail(normalized)
      setToast('Unlocked. Your prescription is ready.')
      window.setTimeout(() => setToast(null), 3200)
    } finally {
      setEmailBusy(false)
    }
  }

  const primaryFlag = result.flags.find((f) => !f.id.startsWith('typical_'))
  const getWeakLiftFromFlagId = (flagId?: RatioFlagId): string | null => {
    if (!flagId) return null

    // Flags represent ratios; the "weak link" is the lift you should bring up.
    if (flagId === 'bench_dominant' || flagId === 'deadlift_dominant') return LIFT_NAMES.squat
    if (flagId === 'squat_dominant') return LIFT_NAMES.deadlift
    if (flagId === 'press_strong') return LIFT_NAMES.bench

    if (flagId === 'press_weak' || flagId.startsWith('press_lagging_')) return LIFT_NAMES.press
    if (flagId === 'bench_lagging' || flagId.startsWith('bench_lagging_')) return LIFT_NAMES.bench
    if (flagId.startsWith('deadlift_lagging_')) return LIFT_NAMES.deadlift
    if (flagId.startsWith('squat_lagging_')) return LIFT_NAMES.squat

    return null
  }

  const weakLinkLabel = primaryFlag?.label ?? result.oneRMs[0]?.name ?? 'Your profile'
  const weakLinkExplanationOneLine = (() => {
    const diag = getHeadlineDiagnosis(result.oneRMs, result.flags, form.units)
    return diag.split(' Bringing it in line')[0] // keep it one line / avoid impact add-ons
  })()

  const actualExperience: FormState['experience'] =
    rawPercentile <= 40 ? 'Beginner' : rawPercentile <= 70 ? 'Intermediate' : 'Advanced'
  const experienceMismatchMessage = (() => {
    if (form.experience === 'Beginner' && (actualExperience === 'Intermediate' || actualExperience === 'Advanced')) {
      const level = actualExperience === 'Advanced' ? 'advanced' : 'intermediate'
      return `Your numbers suggest you're more experienced than you think. You're lifting at an ${level} level for your body weight — own it.`
    }

    const earlyIntermediate = actualExperience === 'Intermediate' && rawPercentile <= 55
    if (form.experience === 'Advanced' && (actualExperience === 'Beginner' || earlyIntermediate)) {
      return `Honest check: your current numbers are at a beginner level for your body weight. The good news? Beginners make the fastest gains. Your ratios show exactly where to focus — follow the prescription and you'll be surprised how quickly you level up.`
    }

    return null
  })()
  const currentWeakLift =
    penaltyPoints > 0 && heroWeakLiftId
      ? LIFT_NAMES[heroWeakLiftId as keyof typeof LIFT_NAMES]
      : getWeakLiftFromFlagId(primaryFlag?.id) ?? weakLinkLabel

  return (
    <div id="results-top" className="rounded-none border border-[#2a2a2a] bg-[#1c1c1c] p-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-2 text-sm text-[#e8c547]"
        >
          {toast}
        </div>
      )}
      {/* Radar chart FIRST */}
      <div className="mb-8">
        <StrengthRadarChart
          oneRMs={result.oneRMs}
          goal={form.primary_goal}
          bodyweight={form.bodyweight}
          units={form.units}
        />

        {/* Distribution curves */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 min-w-0">
          {liftPercentiles.length > 0 ? (
            liftPercentiles.map((lp) => (
              <div key={lp.id} className="min-w-0">
                <PercentileCurve
                  liftName={lp.name}
                  ratioBW={lp.ratioBW}
                  percentile={lp.percentile}
                  typicalRatio={getLiftP50TypicalRatio(lp.id, form.gender, form.bodyweight!)}
                />
                {lp.id === 'press' && (
                  <p className="mt-1 text-[11px] text-[#b0b0b0]">*OHP uses coaching-based standards (Kilgore 2023)*</p>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-2 sm:col-span-4 rounded-none border border-dashed border-[#2a2a2a] bg-[#111111] p-4 text-center">
              <p className="text-sm text-[#b0b0b0]">Enter at least one lift to see distribution curves.</p>
            </div>
          )}
        </div>
      </div>

      {/* Balance score + weak link */}
      <section className="mb-8 border-b border-[#2a2a2a] pb-8">
        <div className="rounded-none border border-[#2a2a2a] bg-[#111111] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[#b0b0b0]">Balance Score</p>
              <div className="mt-1 flex items-end gap-3">
                <div className="font-display text-4xl tracking-[0.02em] text-[#e8c547] leading-[0.9]">
                  {balanceScore}
                </div>
                <div className="pb-1 text-right">
                  <p className="text-xs font-medium text-[#b0b0b0]">Grade {balanceGrade}</p>
                  <p className="mt-1 text-xs font-medium text-[#e8e5df]">
                    {balanceScore >= 90
                      ? 'You&apos;re in great shape — keep training consistently.'
                      : balanceScore >= 80
                        ? 'Close to ideal — focus your next block on your weak ratios.'
                        : 'Dial in your weakest ratios — that&apos;s where progress comes from.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[#b0b0b0]">Your weak link</h3>
            <p className="mt-2 text-lg font-medium text-[#e8e5df] sm:text-xl">
              <span className="text-[#e8c547]">{weakLinkLabel}</span>
            </p>
            <p className="mt-1 text-sm font-medium text-[#e8e5df]">{weakLinkExplanationOneLine}</p>
          </div>
        </div>
      </section>

      {shouldShowScoreComparison &&
        previousScore != null &&
        previousWeakLift != null &&
        previousBand != null && (
          <ScoreComparison
            previousScore={previousScore}
            previousBand={previousBand}
            previousWeakLift={previousWeakLift}
            currentScore={heroScoreValue}
            currentBand={heroBand}
            currentWeakLift={currentWeakLift}
          />
        )}

      {/* Main content */}
      <div className="mb-6 space-y-6">
        {experienceMismatchMessage && (
          <div className="mb-2 rounded-none border border-[#2a2a2a] bg-[#111111] border-l-4 border-l-[#e8c547] p-4">
            <p className="text-sm font-medium text-[#e8e5df]">Experience check</p>
            <p className="mt-1 text-sm font-light text-[#b0b0b0]">{experienceMismatchMessage}</p>
          </div>
        )}

        {result.ratios.length > 0 && (
          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-[#b0b0b0]">Ratios</h3>
                <p className="mt-0.5 text-[11px] text-[#b0b0b0]">Goal-specific ideal ranges and what to fix.</p>
              </div>
              {hasHiddenRatios && (
                <button
                  type="button"
                  onClick={() => setShowAllRatios((v) => !v)}
                  className="text-xs font-light text-[#b0b0b0] underline hover:text-[#e8c547]"
                >
                  {showAllRatios ? 'Show fewer ratios' : 'Show all ratios'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {visibleRatios.map((r) => {
                const flag = result.flags.find((f) => f.label === r.label)
                const idealForGoal = getIdealRangeForGoal(r.id, form.primary_goal)
                const ratioSentence = getPlainEnglishForRatio(r.id, r.value)
                const category: FlagCategory =
                  flag != null ? getFlagCategory(flag.id) : 'balanced'
                const inRange =
                  idealForGoal != null
                    ? r.value >= idealForGoal.min && r.value <= idealForGoal.max
                    : category === 'balanced'

                const diff = idealForGoal
                  ? r.value < idealForGoal.min
                    ? idealForGoal.min - r.value
                    : r.value > idealForGoal.max
                      ? r.value - idealForGoal.max
                      : 0
                  : 0
                const rangeWidth = idealForGoal ? idealForGoal.max - idealForGoal.min : 0
                const closeThreshold = rangeWidth > 0 ? rangeWidth * 0.15 : 0
                const isClose = !inRange && idealForGoal != null && diff <= closeThreshold

                const imbalanceCallout =
                  flag && category !== 'balanced' ? FLAG_IMBALANCE_CALLOUT[flag.id] : null

                const badge = inRange
                  ? { text: 'In range', className: 'bg-[rgba(74,124,89,0.2)] text-[#6fce8c] border border-[rgba(74,124,89,0.4)]' }
                  : category === 'lagging'
                    ? { text: isClose ? 'Close' : 'Fix this', className: 'bg-[rgba(201,79,42,0.2)] text-[#e07a5f] border border-[rgba(201,79,42,0.4)]' }
                    : { text: 'Close', className: 'bg-[rgba(232,197,71,0.15)] text-[#e8c547] border border-[rgba(232,197,71,0.3)]' }

                const leftBorderClass = inRange ? 'border-l-4 border-l-[#4a7c59]' : 'border-l-4 border-l-[#e8c547]'
                const valueClass = inRange
                  ? 'text-[#6fce8c]'
                  : category === 'lagging'
                    ? 'text-[#e07a5f]'
                    : 'text-[#e8c547]'

                return (
                  <div
                    key={r.id}
                    className={`rounded-none border border-[#2a2a2a] bg-[#111111] p-3 ${leftBorderClass} ${
                      inRange ? '' : 'bg-[rgba(232,197,71,0.05)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-[#b0b0b0]">
                        {r.label}
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.text}
                      </span>
                    </div>
                    <div className={`mt-1 text-sm font-semibold ${valueClass}`}>{r.value}</div>

                    {idealForGoal && (
                      <p className="mt-0.5 text-[11px] text-[#b0b0b0]">
                        Ideal: {idealForGoal.rangeLabel}
                      </p>
                    )}

                    <p className="mt-1 text-xs font-light text-[#b0b0b0]">{ratioSentence}</p>

                    {!inRange && (
                      <>
                        {imbalanceCallout && (
                          <p
                            className={`mt-1 text-[11px] font-medium ${
                              category === 'lagging' ? 'text-[#e07a5f]' : 'text-[#e8c547]'
                            }`}
                          >
                            {imbalanceCallout}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-[#b0b0b0]">
                          {category === 'lagging'
                            ? 'A lagging ratio like this can hide weak links that cap your overall strength and push extra stress into nearby joints.'
                            : 'A dominant ratio like this often reflects technique gaps or muscle imbalances that can increase injury risk over time.'}
                        </p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#b0b0b0]">
            Calculated 1RM
          </h3>
          <div className="overflow-hidden rounded-none border border-[#2a2a2a]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[#111111]">
                  <th className="px-4 py-2.5 text-left font-medium text-[#b0b0b0]">
                    Lift
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-[#b0b0b0]">
                    1RM ({form.units})
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.oneRMs.map((r) => (
                  <tr key={r.id} className="border-b border-[#2a2a2a] last:border-b-0">
                    <td className="px-4 py-2 font-light text-[#e8e5df]">{r.name}</td>
                    <td className="px-4 py-2 text-right font-medium text-[#f5f2ec]">
                      {formatKg(r.oneRM, form.units)}
                      {r.method === 'user_provided' && (
                        <span className="ml-1 text-xs text-[#b0b0b0]">(provided)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasUserProvided && (
            <p className="mt-2 text-xs text-[#b0b0b0]">
              Estimated via Epley formula: 1RM = weight × (1 + reps/30)
            </p>
          )}
        </div>

      </div>

      {!prescriptionEmail && (
        <section className="mb-6 rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
          <h3 className="text-sm font-medium text-[#e8e5df]">Unlock your personalised prescription</h3>
          <p className="mt-1 text-sm font-light text-[#b0b0b0]">
            Enter your email to see your specific exercises, sets, reps, and suggested weights.
          </p>

          <form onSubmit={handleGetPrescription} className="mt-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                inputMode="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2.5 text-sm font-light text-[#f5f2ec] placeholder:text-[#b0b0b0] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
              />
              <button
                type="submit"
                disabled={emailBusy}
                className="shrink-0 rounded-none bg-[#5eead4] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#6af0de] focus:outline-none focus:ring-2 focus:ring-[#5eead4]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailBusy ? 'Unlocking…' : 'Get my prescription'}
              </button>
            </div>

            <p className="text-[11px] text-[#b0b0b0]">We'll also send you a reminder to retest in 8 weeks.</p>
          </form>
        </section>
      )}

      {prescriptionEmail && (
        <>
          {/* Top 3 recommendations */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-[#e8e5df]">{recommendationHeader}</h3>
            {form.equipment.length === 0 && (
              <p className="mb-3 text-xs text-[#b0b0b0]">
                No equipment selected — showing recommendations for all equipment types.
              </p>
            )}
            {commonForImbalance && (
              <p className="mb-3 text-xs font-medium text-[#e8c547]">Addresses: {commonForImbalance}</p>
            )}
            <ol className="space-y-3">
              {top3.map((a, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 rounded-none border p-3 ${
                    i === 0
                      ? 'border-l-4 border-l-[#e8c547] border-[#e8c547]/35 bg-[#0f0f0f]'
                      : 'border-[#2a2a2a] bg-[#111111]'
                  }`}
                >
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-none bg-[#e8c547] text-xs font-medium text-[#0a0a0a] ${
                      i === 0 ? 'h-8 w-8 text-sm' : 'h-6 w-6'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {!commonForImbalance && a.forImbalance && (
                      <p className="text-xs font-medium text-[#e8c547]">Addresses: {a.forImbalance}</p>
                    )}
                    {(() => {
                      const display = getAccessoryDisplay(a.name)
                      return (
                        <>
                          <p className="text-sm font-semibold text-[#f5f2ec]">{display.exercise}</p>
                          {display.pattern && <p className="text-xs text-[#b0b0b0]">{display.pattern}</p>}
                        </>
                      )
                    })()}
                    <div className="mt-1 flex flex-col gap-1">
                      <p className="text-sm font-light text-[#b0b0b0]">
                        Sets/Reps: <strong className="text-[#e8e5df] font-semibold">{a.setsReps}</strong>
                      </p>
                      {a.suggestedWeight != null && (
                        <p className="text-sm font-semibold text-[#e8c547]">
                          {formatKg(a.suggestedWeight, form.units)} {form.units} <span className="text-xs font-light text-[#b0b0b0]">suggested</span>
                        </p>
                      )}
                      <p className="text-xs text-[#b0b0b0]">{a.cue ?? cueFallback}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-[#b0b0b0]">{recommendationFooterText}</p>
          </div>

          {/* Coach notes (coach mode only) */}
          {coachMode && (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-[#b0b0b0]">
                Coach notes <span className="text-[#b0b0b0]">(included in PDF)</span>
              </label>
              <textarea
                value={coachNotesLocal}
                onChange={(e) => setCoachNotesLocal(e.target.value)}
                placeholder="Key cues, programming notes, next check-in…"
                rows={4}
                className="w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-4 py-3 text-sm font-light text-[#f5f2ec] placeholder:text-[#b0b0b0] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
              />
            </div>
          )}

          {/* Track your progress reminder */}
          <div className="mb-6 rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
            <p className="text-sm font-medium text-[#f5f2ec]">Track your progress</p>
            <p className="mt-1 text-sm font-light text-[#b0b0b0]">
              Come back in 8 weeks and re-enter your lifts to see how your ratios have shifted. You should also receive an email reminder to retest at the 8-week mark. Your imbalances typically respond within 2-3 training blocks.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleReminder}
                className="flex-1 rounded-none border border-[#e8c547]/40 bg-[#e8c547]/10 px-4 py-2.5 text-sm font-medium text-[#e8c547] hover:bg-[#e8c547]/15"
              >
                Set a reminder (8 weeks)
              </button>
            </div>
            <p className="mt-2 text-xs text-[#b0b0b0]">
              Reminder date: {reminderISO} (copied/shared when tapped).
            </p>
          </div>

          {/* PDF export and Save: bottom, secondary */}
          <div className="flex flex-wrap items-center gap-3 border-t border-[#2a2a2a] pt-6">
            <button
              type="button"
              onClick={handleExport}
              disabled={pdfExportBusy}
              className="text-sm font-medium text-[#b0b0b0] underline hover:text-[#e8c547] disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
            >
              {pdfExportBusy ? 'Exporting…' : 'Export PDF'}
            </button>
            {onSaveScenario && (
              <button
                type="button"
                onClick={async () => {
                  if (saveLinkBusy) return
                  setSaveLinkBusy(true)
                  try {
                    await onSaveScenario()
                    showToast('Link copied! Share it or bookmark it to save your results.')
                  } catch {
                    showToast('Link copy coming soon')
                  } finally {
                    setSaveLinkBusy(false)
                  }
                }}
                disabled={saveLinkBusy}
                className="rounded-none border border-[#2a2a2a] bg-transparent px-4 py-2 text-sm font-medium text-[#b0b0b0] hover:bg-[#2e2e2e] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saveLinkBusy ? 'Copying link…' : 'Save this report'}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-[#b0b0b0]">
            For information only — not medical advice. Use your head.
          </p>

          {/* App waitlist CTA */}
          <section className="mt-6 rounded-none border border-[#2a2a2a] bg-[#111111] p-4">
            <h3 className="text-sm font-medium text-[#e8e5df]">Join the app waitlist</h3>
            <p className="mt-1 text-sm font-light text-[#b0b0b0]">
              Get notified when the full app launches. Your email is pre-filled from your prescription unlock.
            </p>

            <form onSubmit={handleJoinWaitlist} className="mt-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  inputMode="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-none border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2.5 text-sm font-light text-[#f5f2ec] placeholder:text-[#b0b0b0] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
                />
                <button
                  type="submit"
                  disabled={waitlistBusy}
                  className="shrink-0 rounded-none bg-[#5eead4] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#6af0de] focus:outline-none focus:ring-2 focus:ring-[#5eead4]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {waitlistBusy ? 'Joining…' : 'Join waitlist'}
                </button>
              </div>
              <p className="text-[11px] text-[#b0b0b0]">No spam. One email when beta opens.</p>
            </form>
          </section>
        </>
      )}
    </div>
  )
}
