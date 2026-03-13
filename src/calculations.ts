import type {
  LiftId,
  LiftInput,
  DiagnosticResult,
  RatioFlag,
  AccessoryExercise,
  Lift1RM,
  LiftPercentile,
  RatioFlagId,
  ConfidenceLevel,
  FormState,
  Experience,
  PrimaryGoal,
} from './types'

const ROUND_1 = (n: number) => Math.round(n * 10) / 10
const ROUND_2 = (n: number) => Math.round(n * 100) / 100

/**
 * Epley formula: 1RM = weight * (1 + reps/30)
 * RULES.md §1
 */
export function epley1RM(weight: number, reps: number): number {
  if (reps < 1 || weight <= 0) return 0
  return ROUND_1(weight * (1 + reps / 30))
}

/**
 * Compute 1RM for a single lift input.
 * RULES.md §1 — returns { oneRM, method } or null if invalid.
 */
export function compute1RM(lift: LiftInput): { oneRM: number; method: 'epley' | 'user_provided' } | null {
  if (lift.method === 'one_rm' && typeof lift.one_rm === 'number' && lift.one_rm > 0) {
    return { oneRM: ROUND_1(lift.one_rm), method: 'user_provided' }
  }
  if (
    lift.method === 'weight_reps' &&
    typeof lift.weight === 'number' &&
    lift.weight > 0 &&
    typeof lift.reps === 'number' &&
    lift.reps >= 1 &&
    lift.reps <= 20
  ) {
    return { oneRM: epley1RM(lift.weight, lift.reps), method: 'epley' }
  }
  return null
}

/**
 * Compute 1RMs for all valid lifts.
 */
export function compute1RMs(lifts: LiftInput[]): Lift1RM[] {
  const result: Lift1RM[] = []
  for (const lift of lifts) {
    const computed = compute1RM(lift)
    if (computed) {
      result.push({
        id: lift.id as LiftId,
        name: lift.name,
        oneRM: computed.oneRM,
        method: computed.method,
      })
    }
  }
  return result
}

function get1RMByLift(oneRMs: Lift1RM[]): Partial<Record<LiftId, number>> {
  const map: Partial<Record<LiftId, number>> = {}
  for (const row of oneRMs) {
    map[row.id] = row.oneRM
  }
  return map
}

/**
 * Compute ratios — only when both lifts exist.
 * RULES.md §2: bench_to_squat, squat_to_deadlift, press_to_bench. Round to 2 decimals.
 */
export function computeRatios(oneRMs: Lift1RM[]): { id: string; label: string; value: number }[] {
  const byLift = get1RMByLift(oneRMs)
  const out: { id: string; label: string; value: number }[] = []

  if (byLift.bench != null && byLift.squat != null && byLift.squat > 0) {
    out.push({
      id: 'bench_to_squat',
      label: 'Bench : Squat',
      value: ROUND_2(byLift.bench / byLift.squat),
    })
  }
  if (byLift.squat != null && byLift.deadlift != null && byLift.deadlift > 0) {
    out.push({
      id: 'squat_to_deadlift',
      label: 'Squat : Deadlift',
      value: ROUND_2(byLift.squat / byLift.deadlift),
    })
  }
  if (byLift.press != null && byLift.bench != null && byLift.bench > 0) {
    out.push({
      id: 'press_to_bench',
      label: 'Press : Bench',
      value: ROUND_2(byLift.press / byLift.bench),
    })
  }
  // Lower-to-upper cross-body ratios
  if (byLift.squat != null && byLift.bench != null && byLift.bench > 0) {
    out.push({
      id: 'squat_to_bench',
      label: 'Squat : Bench',
      value: ROUND_2(byLift.squat / byLift.bench),
    })
  }
  if (byLift.deadlift != null && byLift.bench != null && byLift.bench > 0) {
    out.push({
      id: 'deadlift_to_bench',
      label: 'Deadlift : Bench',
      value: ROUND_2(byLift.deadlift / byLift.bench),
    })
  }
  if (byLift.squat != null && byLift.press != null && byLift.press > 0) {
    out.push({
      id: 'squat_to_press',
      label: 'Squat : Press',
      value: ROUND_2(byLift.squat / byLift.press),
    })
  }
  if (byLift.deadlift != null && byLift.press != null && byLift.press > 0) {
    out.push({
      id: 'deadlift_to_press',
      label: 'Deadlift : Press',
      value: ROUND_2(byLift.deadlift / byLift.press),
    })
  }
  return out
}

// Ideal ratio targets (midpoint of typical ranges). RULES.md §3.
// Lower-to-upper ratios derived from TYPICAL_RATIO_BW (squat 1.25, bench 1.0, deadlift 1.5, press 0.6).
export const IDEAL_RATIOS: Record<string, { ideal: number; range: string }> = {
  bench_to_squat: { ideal: 0.75, range: '0.45–1.1' },
  squat_to_deadlift: { ideal: 0.9, range: '0.8–1.0' },
  press_to_bench: { ideal: 0.4, range: '0.35–0.45' },
  // Lower : Upper cross-body ratios
  squat_to_bench: { ideal: 1.25, range: '1.0–1.5' },
  deadlift_to_bench: { ideal: 1.5, range: '1.3–1.7' },
  squat_to_press: { ideal: 2.08, range: '1.8–2.4' },
  deadlift_to_press: { ideal: 2.5, range: '2.2–2.8' },
}

/** Goal-specific ideal ratio ranges for display. */
export const IDEAL_RATIOS_BY_GOAL: Record<
  PrimaryGoal,
  Record<string, { min: number; max: number; rangeLabel: string }>
> = {
  Strength: {
    bench_to_squat: { min: 0.75, max: 0.85, rangeLabel: '0.75–0.85' },
    squat_to_deadlift: { min: 0.85, max: 1.0, rangeLabel: '0.85–1.0' },
    deadlift_to_bench: { min: 1.6, max: 1.8, rangeLabel: '1.6–1.8' },
    press_to_bench: { min: 0.35, max: 0.45, rangeLabel: '0.35–0.45' },
    squat_to_bench: { min: 1.18, max: 1.33, rangeLabel: '1.18–1.33' },
    squat_to_press: { min: 1.8, max: 2.4, rangeLabel: '1.8–2.4' },
    deadlift_to_press: { min: 2.2, max: 2.8, rangeLabel: '2.2–2.8' },
  },
  Hypertrophy: {
    bench_to_squat: { min: 0.7, max: 0.8, rangeLabel: '0.7–0.8' },
    squat_to_deadlift: { min: 0.8, max: 1.0, rangeLabel: '0.8–1.0' },
    deadlift_to_bench: { min: 1.5, max: 1.8, rangeLabel: '1.5–1.8' },
    press_to_bench: { min: 0.35, max: 0.45, rangeLabel: '0.35–0.45' },
    squat_to_bench: { min: 1.0, max: 1.5, rangeLabel: '1.0–1.5' },
    squat_to_press: { min: 1.8, max: 2.4, rangeLabel: '1.8–2.4' },
    deadlift_to_press: { min: 2.2, max: 2.8, rangeLabel: '2.2–2.8' },
  },
  Power: {
    bench_to_squat: { min: 0.7, max: 0.75, rangeLabel: '0.7–0.75' },
    squat_to_deadlift: { min: 0.9, max: 1.05, rangeLabel: '0.9–1.05' },
    deadlift_to_bench: { min: 1.5, max: 1.7, rangeLabel: '1.5–1.7' },
    press_to_bench: { min: 0.35, max: 0.45, rangeLabel: '0.35–0.45' },
    squat_to_bench: { min: 1.0, max: 1.5, rangeLabel: '1.0–1.5' },
    squat_to_press: { min: 1.8, max: 2.4, rangeLabel: '1.8–2.4' },
    deadlift_to_press: { min: 2.2, max: 2.8, rangeLabel: '2.2–2.8' },
  },
  Rehab: {
    bench_to_squat: { min: 0.45, max: 1.1, rangeLabel: '0.45–1.1' },
    squat_to_deadlift: { min: 0.75, max: 1.05, rangeLabel: '0.75–1.05' },
    deadlift_to_bench: { min: 1.3, max: 1.9, rangeLabel: '1.3–1.9' },
    press_to_bench: { min: 0.3, max: 0.5, rangeLabel: '0.3–0.5' },
    squat_to_bench: { min: 0.9, max: 1.6, rangeLabel: '0.9–1.6' },
    squat_to_press: { min: 1.6, max: 2.5, rangeLabel: '1.6–2.5' },
    deadlift_to_press: { min: 2.0, max: 2.9, rangeLabel: '2.0–2.9' },
  },
}

export function getIdealRangeForGoal(
  ratioId: string,
  goal: PrimaryGoal
): { min: number; max: number; rangeLabel: string } | null {
  return IDEAL_RATIOS_BY_GOAL[goal]?.[ratioId] ?? null
}

/**
 * Generate flags from ratios. RULES.md §3.
 */
export function generateFlags(ratios: { id: string; value: number }[]): RatioFlag[] {
  const flags: RatioFlag[] = []

  const benchToSquat = ratios.find((r) => r.id === 'bench_to_squat')
  if (benchToSquat != null) {
    const v = benchToSquat.value
    let id: RatioFlagId
    let message: string
    if (v > 1.1) {
      id = 'bench_dominant'
      message = 'Bench dominant relative to squat — consider prioritising lower-body work.'
    } else if (v < 0.45) {
      id = 'bench_lagging'
      message = 'Bench lagging; likely to benefit from horizontal push and triceps work.'
    } else {
      id = 'typical_bench_squat'
      message = 'Bench : Squat within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Bench : Squat', message })
  }

  const squatToDeadlift = ratios.find((r) => r.id === 'squat_to_deadlift')
  if (squatToDeadlift != null) {
    const v = squatToDeadlift.value
    let id: RatioFlagId
    let message: string
    if (v < 0.8) {
      id = 'deadlift_dominant'
      message = 'Deadlift dominant; may indicate prioritising posterior-chain accessories.'
    } else if (v > 1.0) {
      id = 'squat_dominant'
      message = 'Squat dominant relative to deadlift — consider deadlift volume.'
    } else {
      id = 'typical_squat_deadlift'
      message = 'Squat : Deadlift within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Squat : Deadlift', message })
  }

  const pressToBench = ratios.find((r) => r.id === 'press_to_bench')
  if (pressToBench != null) {
    const v = pressToBench.value
    let id: RatioFlagId
    let message: string
    if (v < 0.35) {
      id = 'press_weak'
      message = 'Overhead weak; consider shoulder stability and pressing volume.'
    } else if (v > 0.45) {
      id = 'press_strong'
      message = 'Press strong relative to bench.'
    } else {
      id = 'typical_press_bench'
      message = 'Press : Bench within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Press : Bench', message })
  }

  // Lower-to-upper cross-body ratio flags
  const squatToBench = ratios.find((r) => r.id === 'squat_to_bench')
  if (squatToBench != null) {
    const v = squatToBench.value
    let id: RatioFlagId
    let message: string
    if (v < 1.0) {
      id = 'squat_lagging_bench'
      message = 'Squat lagging relative to bench — consider prioritising lower-body work.'
    } else if (v > 1.5) {
      id = 'bench_lagging_squat'
      message = 'Bench lagging relative to squat — consider horizontal push and triceps work.'
    } else {
      id = 'typical_squat_bench'
      message = 'Squat : Bench within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Squat : Bench', message })
  }

  const deadliftToBench = ratios.find((r) => r.id === 'deadlift_to_bench')
  if (deadliftToBench != null) {
    const v = deadliftToBench.value
    let id: RatioFlagId
    let message: string
    if (v < 1.3) {
      id = 'deadlift_lagging_bench'
      message =
        'Deadlift lagging relative to bench — increase posterior-chain volume (aim ~6–10 hard sets/week of hinge + hamstring work for 4–6 weeks).'
    } else if (v > 1.7) {
      id = 'bench_lagging_deadlift'
      message = 'Bench lagging relative to deadlift — consider horizontal push work.'
    } else {
      id = 'typical_deadlift_bench'
      message = 'Deadlift : Bench within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Deadlift : Bench', message })
  }

  const squatToPress = ratios.find((r) => r.id === 'squat_to_press')
  if (squatToPress != null) {
    const v = squatToPress.value
    let id: RatioFlagId
    let message: string
    if (v < 1.8) {
      id = 'squat_lagging_press'
      message =
        'Squat lagging relative to press — increase lower-body volume (aim ~8–14 hard sets/week quads+glutes; add ~2–4 sets/week if you already train legs hard).'
    } else if (v > 2.4) {
      id = 'press_lagging_squat'
      message = 'Press lagging relative to squat — consider shoulder and pressing volume.'
    } else {
      id = 'typical_squat_press'
      message = 'Squat : Press within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Squat : Press', message })
  }

  const deadliftToPress = ratios.find((r) => r.id === 'deadlift_to_press')
  if (deadliftToPress != null) {
    const v = deadliftToPress.value
    let id: RatioFlagId
    let message: string
    if (v < 2.2) {
      id = 'deadlift_lagging_press'
      message =
        'Deadlift lagging relative to press — add posterior-chain work (aim ~6–10 hard sets/week hinges/hamstrings; or +2–4 sets/week if already doing it).'
    } else if (v > 2.8) {
      id = 'press_lagging_deadlift'
      message = 'Press lagging relative to deadlift — consider overhead pressing volume.'
    } else {
      id = 'typical_deadlift_press'
      message = 'Deadlift : Press within typical range.'
    }
    flags.push({ id, ratio: v, label: 'Deadlift : Press', message })
  }

  return flags
}

/**
 * Confidence scoring. RULES.md §4.
 * High: 4 lifts + experience + bodyweight. Medium: 2–3 lifts. Low: 1 lift or missing experience.
 */
export function computeConfidence(inputs: {
  lifts: LiftInput[]
  bodyweight?: number
  experience: Experience
}): ConfidenceLevel {
  const validLiftCount = inputs.lifts.filter(
    (l) =>
      (l.method === 'one_rm' && l.one_rm != null && l.one_rm > 0) ||
      (l.method === 'weight_reps' &&
        l.weight != null &&
        l.weight > 0 &&
        l.reps != null &&
        l.reps >= 1 &&
        l.reps <= 20)
  ).length

  if (validLiftCount === 1 || !inputs.experience) return 'Low'
  if (validLiftCount >= 2 && validLiftCount <= 3) return 'Medium'
  if (validLiftCount === 4 && inputs.bodyweight != null && inputs.experience) return 'High'
  return 'Medium' // 4 lifts but missing bodyweight
}

/** Explain why confidence is at this level (for tooltip). */
export function getConfidenceReasons(inputs: {
  lifts: LiftInput[]
  bodyweight?: number
  experience: Experience
  confidence: ConfidenceLevel
}): string {
  const validLifts = inputs.lifts.filter(
    (l) =>
      (l.method === 'one_rm' && l.one_rm != null && l.one_rm > 0) ||
      (l.method === 'weight_reps' &&
        l.weight != null &&
        l.weight > 0 &&
        l.reps != null &&
        l.reps >= 1 &&
        l.reps <= 20)
  )
  const count = validLifts.length
  const parts: string[] = []

  if (count < 4) {
    parts.push(`only ${count} of 4 lifts were entered`)
  }
  const withReps = validLifts.filter(
    (l) => l.method === 'weight_reps' && typeof l.reps === 'number'
  )
  const maxReps = withReps.length
    ? Math.max(...withReps.map((l) => l.reps ?? 0))
    : 0
  if (maxReps >= 10) {
    parts.push(`the rep range used (up to ${maxReps} reps) introduces ~5% estimation variance`)
  } else if (maxReps >= 5 && maxReps < 10) {
    parts.push('the rep range used introduces some estimation variance')
  }
  if (inputs.bodyweight == null || inputs.bodyweight <= 0) {
    parts.push('bodyweight was not provided (affects ratio calibration)')
  }
  const reason =
    parts.length > 0
      ? `Confidence is ${inputs.confidence} because: ${parts.join(', ')}.`
      : `Confidence is ${inputs.confidence} based on complete inputs.`
  return reason
}

/**
 * Headline diagnosis: one bold sentence at top of report (emotional hook).
 * Identifies worst imbalance and optional estimated impact.
 */
export function getHeadlineDiagnosis(
  oneRMs: Lift1RM[],
  flags: RatioFlag[],
): string {
  const byLift = get1RMByLift(oneRMs)
  const flagged = flags.filter((f) => !f.id.startsWith('typical_'))

  if (flagged.length === 0) {
    return "Great news — your lifts are well-balanced. Here's how to keep building evenly."
  }

  // Pick the first (prioritised) imbalance for the headline
  const primary = flagged[0]!
  void primary.ratio

  // Estimated impact: for bench_lagging_squat / bench_lagging, bringing bench in line with squat
  let impactKg: number | null = null
  if (
    (primary.id === 'bench_lagging' || primary.id === 'bench_lagging_squat' || primary.id === 'bench_lagging_deadlift') &&
    byLift.squat != null &&
    byLift.bench != null &&
    byLift.squat > 0
  ) {
    const targetBench = byLift.squat * 0.78 // midpoint of ideal bench:squat
    if (targetBench > byLift.bench) impactKg = ROUND_1(targetBench - byLift.bench)
  }
  if (
    (primary.id === 'squat_lagging_bench' || primary.id === 'squat_lagging_press') &&
    byLift.bench != null &&
    byLift.squat != null &&
    byLift.bench > 0
  ) {
    const targetSquat = byLift.bench / 0.78
    if (targetSquat > byLift.squat) impactKg = ROUND_1(targetSquat - byLift.squat)
  }

  const impactPhrase =
    impactKg != null && impactKg >= 1
      ? ` Bringing it in line could add an estimated ${impactKg} kg to your total.`
      : ''

  if (primary.id === 'bench_lagging' || primary.id === 'bench_lagging_squat' || primary.id === 'bench_lagging_deadlift') {
    return `Your bench press is your limiting lift — horizontal push and triceps work will help.${impactPhrase}`
  }
  if (primary.id === 'squat_lagging_bench' || primary.id === 'squat_lagging_press') {
    return `Your squat is lagging behind your deadlift. Quad and anterior-chain work will unlock your next training block.${impactPhrase}`
  }
  if (primary.id === 'deadlift_dominant' || primary.id === 'squat_dominant') {
    return `Your squat-to-deadlift balance is off. ${primary.id === 'deadlift_dominant' ? 'Posterior-chain accessories will round out your lower body.' : 'Adding deadlift volume will bring your total up.'}`
  }
  if (primary.id === 'deadlift_lagging_bench' || primary.id === 'deadlift_lagging_press') {
    return 'Your deadlift is lagging relative to your upper body. Hinge and hamstring volume for 4–6 weeks will close the gap.'
  }
  if (primary.id === 'press_weak' || primary.id === 'press_lagging_squat' || primary.id === 'press_lagging_deadlift') {
    return 'Your overhead press is the bottleneck. Shoulder stability and pressing volume will pay off across your other lifts.'
  }
  if (primary.id === 'press_strong') {
    return 'Your press is strong relative to bench — consider more horizontal push and triceps work to grow your total.'
  }
  return primary.message + (impactPhrase ? impactPhrase : '')
}

/** Radar chart: normalized (0–100) values per lift for user and goal-ideal profile. */
export function getRadarChartData(
  oneRMs: Lift1RM[],
  goal: PrimaryGoal,
  bodyweight?: number
): { subject: string; user: number; ideal: number; oneRM: number }[] {
  const order: LiftId[] = ['squat', 'bench', 'deadlift', 'press']
  const idealRatios: Record<LiftId, number> = {
    Strength: { squat: 1.25, bench: 1.0, deadlift: 1.5, press: 0.6 },
    Hypertrophy: { squat: 1.2, bench: 1.0, deadlift: 1.45, press: 0.58 },
    Power: { squat: 1.22, bench: 1.0, deadlift: 1.48, press: 0.58 },
    Rehab: { squat: 1.2, bench: 1.0, deadlift: 1.4, press: 0.55 },
  }[goal] ?? { squat: 1.25, bench: 1.0, deadlift: 1.5, press: 0.6 }

  const userByLift: Partial<Record<LiftId, number>> = {}
  for (const r of oneRMs) {
    userByLift[r.id] = r.oneRM
  }
  const maxUser = Math.max(...order.map((id) => userByLift[id] ?? 0), 1)
  const maxIdeal = Math.max(...Object.values(idealRatios))

  const out: { subject: string; user: number; ideal: number; oneRM: number }[] = []
  const LIFT_NAMES: Record<LiftId, string> = {
    squat: 'Squat',
    bench: 'Bench Press',
    deadlift: 'Deadlift',
    press: 'Overhead Press',
  }
  for (const id of order) {
    const oneRM = userByLift[id] ?? 0
    out.push({
      subject: LIFT_NAMES[id],
      user: ROUND_1((oneRM / maxUser) * 100),
      ideal: ROUND_1((idealRatios[id]! / maxIdeal) * 100),
      oneRM,
    })
  }
  if (bodyweight != null && bodyweight > 0) {
    const ratioBW = ROUND_2((userByLift.bench ?? 0) / bodyweight) // use bench as proxy for "strength relative to BW"
    const idealBW = idealRatios.bench ?? 1
    out.push({
      subject: 'BW ratio',
      user: ROUND_1(Math.min(100, (ratioBW / (idealBW * 1.2)) * 100)),
      ideal: 83,
      oneRM: ratioBW,
    })
  }
  return out
}

/** Plain-English one-sentence translation for each ratio (max ~18 words). */
export function getPlainEnglishForRatio(
  ratioId: string,
  value: number
): string {
  if (ratioId === 'bench_to_squat') {
    if (value < 0.6) return 'Your bench is behind your squat — common for newer lifters, worth addressing.'
    if (value > 0.9) return 'Your bench is strong relative to your squat — consider prioritising legs.'
    return 'Your bench and squat are in a typical balance.'
  }
  if (ratioId === 'squat_to_deadlift') {
    if (value < 0.8) return 'Your deadlift is pulling ahead of your squat — this gap can increase lower-back fatigue over time.'
    if (value > 1.0) return 'Your squat is ahead of your deadlift — adding deadlift volume will help.'
    return 'Your squat and deadlift are well matched.'
  }
  if (ratioId === 'deadlift_to_bench') {
    if (value > 1.7) return 'Your deadlift is well ahead of your bench — your upper body push strength is the bottleneck.'
    if (value < 1.3) return 'Your deadlift is behind your bench — posterior-chain work will help.'
    return 'Your deadlift and bench are in a good balance.'
  }
  if (ratioId === 'press_to_bench') {
    if (value < 0.35) return 'Your overhead press is lagging — shoulder and pressing volume will help.'
    if (value > 0.45) return 'Your press is strong relative to bench.'
    return 'Your press and bench are in a typical range.'
  }
  if (ratioId === 'squat_to_bench') {
    if (value < 1.0) return 'Your squat is behind your bench — lower-body volume will help.'
    if (value > 1.5) return 'Your bench is behind your squat — horizontal push work is the priority.'
    return 'Squat and bench are in a good balance.'
  }
  if (ratioId === 'squat_to_press') {
    if (value < 1.8) return 'Your squat is lagging relative to press — lower-body focus will help.'
    if (value > 2.4) return 'Your press is lagging relative to squat — overhead work is the priority.'
    return 'Squat and press are in a typical balance.'
  }
  if (ratioId === 'deadlift_to_press') {
    if (value < 2.2) return 'Your deadlift is behind your press — posterior-chain volume will help.'
    if (value > 2.8) return 'Your press is lagging relative to deadlift.'
    return 'Deadlift and press are in a good balance.'
  }
  return 'Use the ratio to guide your next focus.'
}

/**
 * Aggregate "balance score" 0–100 based on how close each ratio is to its ideal
 * range for the user's goal. 100 = all ratios in range, lower scores = further
 * from ideal. Heuristic, not a medical or competition-grade metric.
 */
export function computeBalanceScore(
  ratios: { id: string; value: number }[],
  _flags: RatioFlag[],
  goal: PrimaryGoal
): number {
  const perRatioScores: number[] = []

  for (const r of ratios) {
    const range = getIdealRangeForGoal(r.id, goal)
    if (!range) continue

    const { min, max } = range
    const v = r.value

    let scoreForRatio: number
    if (v >= min && v <= max) {
      scoreForRatio = 100
    } else if (v < min) {
      const dist = min - v
      const denom = min || 1
      scoreForRatio = Math.max(0, 100 - (dist / denom) * 100)
    } else {
      const dist = v - max
      const denom = max || 1
      scoreForRatio = Math.max(0, 100 - (dist / denom) * 100)
    }

    perRatioScores.push(Math.max(0, Math.min(100, scoreForRatio)))
  }

  if (perRatioScores.length === 0) return 50

  const avg = perRatioScores.reduce((sum, s) => sum + s, 0) / perRatioScores.length
  return Math.round(avg)
}

// Short callout for each imbalance so users don't have to interpret ratios
export const FLAG_IMBALANCE_CALLOUT: Partial<Record<RatioFlagId, string>> = {
  bench_dominant: 'Bench is overweighted relative to squat',
  bench_lagging: 'Bench is underweighted relative to squat',
  deadlift_dominant: 'Deadlift is overweighted relative to squat',
  squat_dominant: 'Squat is overweighted relative to deadlift',
  press_weak: 'Press is underweighted relative to bench',
  press_strong: 'Press is overweighted relative to bench',
  squat_lagging_bench: 'Squat is underweighted relative to bench',
  bench_lagging_squat: 'Bench is underweighted relative to squat',
  deadlift_lagging_bench: 'Deadlift is underweighted relative to bench',
  bench_lagging_deadlift: 'Bench is underweighted relative to deadlift',
  squat_lagging_press: 'Squat is underweighted relative to press',
  press_lagging_squat: 'Press is underweighted relative to squat',
  deadlift_lagging_press: 'Deadlift is underweighted relative to press',
  press_lagging_deadlift: 'Press is underweighted relative to deadlift',
}

// RULES.md §5 — Accessory mapping with priorities and injury fallbacks
const ACCESSORY_MAP: Record<
  string,
  { priorities: string[]; fallback_if_knee_injury?: string[]; fallback_if_lower_back_pain?: string[] }
> = {
  bench_dominant: {
    priorities: ['Squat strength 3x5', 'Lower-body volume 3x8', 'Hip drive work 3x10'],
    fallback_if_knee_injury: ['Romanian deadlift 3x6', 'Glute bridge 3x8'],
  },
  deadlift_dominant: {
    priorities: ['RDL 3x6', 'Glute bridge 3x8', 'Hamstring curl 3x10'],
    fallback_if_lower_back_pain: ['Hip thrust 3x6', 'Single-leg RDL light'],
  },
  bench_lagging: {
    priorities: ['Horizontal push volume 3x8', 'Close-grip bench 3x6', 'Triceps work 3x10'],
  },
  press_weak: {
    priorities: ['Seated DB press 3x6', 'Face pulls 3x12', 'Lateral raises 3x10'],
  },
  squat_dominant: {
    priorities: ['Deadlift volume 3x5', 'RDL 3x6', 'Block pulls 3x5'],
  },
  press_strong: {
    priorities: ['Bench volume 3x6', 'Incline bench 3x8', 'Triceps work 3x10'],
  },
  // Lower-to-upper cross-body flags
  squat_lagging_bench: {
    priorities: ['Squat strength 3x5', 'Lower-body volume 3x8', 'Hip drive work 3x10'],
    fallback_if_knee_injury: ['Romanian deadlift 3x6', 'Glute bridge 3x8'],
  },
  bench_lagging_squat: {
    priorities: ['Horizontal push volume 3x8', 'Close-grip bench 3x6', 'Triceps work 3x10'],
  },
  deadlift_lagging_bench: {
    priorities: ['RDL 3x6', 'Glute bridge 3x8', 'Hamstring curl 3x10'],
    fallback_if_lower_back_pain: ['Hip thrust 3x6', 'Single-leg RDL light'],
  },
  bench_lagging_deadlift: {
    priorities: ['Horizontal push volume 3x8', 'Close-grip bench 3x6', 'Triceps work 3x10'],
  },
  squat_lagging_press: {
    priorities: ['Squat strength 3x5', 'Lower-body volume 3x8', 'Hip drive work 3x10'],
    fallback_if_knee_injury: ['Romanian deadlift 3x6', 'Glute bridge 3x8'],
  },
  press_lagging_squat: {
    priorities: ['Seated DB press 3x6', 'Face pulls 3x12', 'Lateral raises 3x10'],
  },
  deadlift_lagging_press: {
    priorities: ['RDL 3x6', 'Glute bridge 3x8', 'Hamstring curl 3x10'],
    fallback_if_lower_back_pain: ['Hip thrust 3x6', 'Single-leg RDL light'],
  },
  press_lagging_deadlift: {
    priorities: ['Seated DB press 3x6', 'Face pulls 3x12', 'Lateral raises 3x10'],
  },
}

// Typical ratioBW for 50th percentile (intermediate). Used for heuristic percentiles.
export const TYPICAL_RATIO_BW: Record<LiftId, number> = {
  squat: 1.25,
  bench: 1.0,
  deadlift: 1.5,
  press: 0.6,
}

// Experience-adjusted typical ratioBW anchors.
// These are heuristic reference points (not a normative standard).
export const TYPICAL_RATIO_BW_BY_EXPERIENCE: Record<Experience, Record<LiftId, number>> = {
  Beginner: { squat: 1.0, bench: 0.75, deadlift: 1.25, press: 0.45 },
  Intermediate: TYPICAL_RATIO_BW,
  Advanced: { squat: 1.75, bench: 1.3, deadlift: 2.05, press: 0.8 },
}

function getTypicalRatioBW(liftId: LiftId, experience: Experience): number | undefined {
  return TYPICAL_RATIO_BW_BY_EXPERIENCE[experience]?.[liftId]
}

/** Compute heuristic percentile from ratioBW (no external dataset). */
export function computeLiftPercentiles(
  oneRMs: Lift1RM[],
  bodyweight: number | undefined,
  experience: Experience
): LiftPercentile[] {
  if (bodyweight == null || bodyweight <= 0) return []
  const result: LiftPercentile[] = []
  for (const lift of oneRMs) {
    const typical = getTypicalRatioBW(lift.id, experience)
    if (typical == null) continue
    const ratioBW = ROUND_2(lift.oneRM / bodyweight)
    // Heuristic: 50 + (actual - typical) / typical * 50, clamped 0–100
    const rawPct = 50 + ((ratioBW - typical) / typical) * 50
    const percentile = Math.round(Math.max(0, Math.min(100, rawPct)))
    result.push({ id: lift.id, name: lift.name, ratioBW, percentile })
  }
  return result
}

// Map accessory names to related lift for weight suggestion (% of 1RM)
const ACCESSORY_TO_LIFT: Record<string, { lift: LiftId; pct: number }> = {
  RDL: { lift: 'deadlift', pct: 0.65 },
  'Romanian deadlift': { lift: 'deadlift', pct: 0.65 },
  'Glute bridge': { lift: 'deadlift', pct: 0.5 },
  'Hip thrust': { lift: 'deadlift', pct: 0.6 },
  'Hamstring curl': { lift: 'deadlift', pct: 0.25 },
  'Squat strength': { lift: 'squat', pct: 0.8 },
  'Lower-body volume': { lift: 'squat', pct: 0.7 },
  'Hip drive work': { lift: 'squat', pct: 0.5 },
  'Horizontal push volume': { lift: 'bench', pct: 0.7 },
  'Close-grip bench': { lift: 'bench', pct: 0.75 },
  'Triceps work': { lift: 'bench', pct: 0.4 },
  'Seated DB press': { lift: 'press', pct: 0.6 },
  'Face pulls': { lift: 'press', pct: 0.15 },
  'Lateral raises': { lift: 'press', pct: 0.2 },
  'Deadlift volume': { lift: 'deadlift', pct: 0.85 },
  'Block pulls': { lift: 'deadlift', pct: 0.8 },
  'Deficit deadlift': { lift: 'deadlift', pct: 0.75 },
  'Bench volume': { lift: 'bench', pct: 0.75 },
  'Incline bench': { lift: 'bench', pct: 0.65 },
  'Landmine press': { lift: 'press', pct: 0.5 },
  'Push-ups': { lift: 'bench', pct: 0.5 },
  'Rack pull': { lift: 'deadlift', pct: 0.9 },
  'Single-leg RDL light': { lift: 'deadlift', pct: 0.35 },
  'Dumbbell bench': { lift: 'bench', pct: 0.35 },
}

const ACCESSORY_CUES: Record<string, string> = {
  RDL: 'Hinge at hips, slight knee bend.',
  'Romanian deadlift': 'Hinge at hips, slight knee bend.',
  'Glute bridge': 'Squeeze glutes at top.',
  'Hamstring curl': 'Control the eccentric.',
  'Close-grip bench': 'Elbows tucked, triceps focus.',
  'Seated DB press': 'Press up, don\'t sway.',
  'Face pulls': 'External rotation at end.',
  'Lateral raises': 'Lead with elbows.',
}

function toAccessoryExercise(s: string, oneRMs: Lift1RM[]): AccessoryExercise {
  const match = s.match(/^(.+?)\s+(\d+x\d+)$/)
  const name = match ? match[1].trim() : s
  const setsReps = match ? match[2] : ''
  const mapping = ACCESSORY_TO_LIFT[name]
  let suggestedWeight: number | undefined
  if (mapping) {
    const lift1RM = oneRMs.find((r) => r.id === mapping.lift)
    if (lift1RM) {
      suggestedWeight = ROUND_1(lift1RM.oneRM * mapping.pct)
    }
  }
  const cue = ACCESSORY_CUES[name]
  return { name, setsReps, suggestedWeight, cue }
}

// Lower-body imbalance flags — prioritise these for accessory selection when present
const LOWER_BODY_FLAG_IDS = [
  'deadlift_lagging_bench',
  'deadlift_lagging_press',
  'squat_lagging_bench',
  'squat_lagging_press',
] as const

function getPrioritisedFlags(flagged: RatioFlag[]): RatioFlag[] {
  const lower = flagged.filter((f) => LOWER_BODY_FLAG_IDS.includes(f.id as (typeof LOWER_BODY_FLAG_IDS)[number]))
  const upper = flagged.filter((f) => !LOWER_BODY_FLAG_IDS.includes(f.id as (typeof LOWER_BODY_FLAG_IDS)[number]))
  return [...lower, ...upper]
}

function getAccessories(
  flags: RatioFlag[],
  _injury: boolean,
  injuryNotes: string | undefined,
  oneRMs: Lift1RM[]
): AccessoryExercise[] {
  const toAcc = (s: string) => toAccessoryExercise(s, oneRMs)
  const flagged = flags.filter((f) => !f.id.startsWith('typical_'))
  const prioritised = getPrioritisedFlags(flagged)

  if (prioritised.length === 0) {
    return [toAcc('RDL 3x6'), toAcc('Glute bridge 3x8'), toAcc('Hamstring curl 3x10')]
  }

  const notes = (injuryNotes ?? '').toLowerCase()
  const hasKneeNote = notes.includes('knee')
  const hasBackNote = notes.includes('back')

  function getExercisesForFlag(flag: RatioFlag): string[] {
    const mapping = ACCESSORY_MAP[flag.id]
    if (!mapping) return []
    if ((flag.id === 'bench_dominant' || flag.id === 'squat_lagging_bench' || flag.id === 'squat_lagging_press') && hasKneeNote) {
      return mapping.fallback_if_knee_injury ?? mapping.priorities
    }
    if ((flag.id === 'deadlift_dominant' || flag.id === 'deadlift_lagging_bench' || flag.id === 'deadlift_lagging_press') && hasBackNote) {
      return mapping.fallback_if_lower_back_pain ?? mapping.priorities
    }
    return mapping.priorities
  }

  // Collect accessories from prioritised flags, aiming to cover distinct imbalances first
  const seen = new Set<string>()
  const result: AccessoryExercise[] = []
  const targetCount = 3
  const perFlagExercises: { flag: RatioFlag; exercises: string[] }[] = prioritised.map((flag) => ({
    flag,
    exercises: getExercisesForFlag(flag),
  }))

  // First pass: 1 exercise per imbalance (flag) to diversify recommendations
  let exerciseIndex = 0
  while (result.length < targetCount && exerciseIndex < 3) {
    let addedInThisRound = false
    for (const { flag, exercises } of perFlagExercises) {
      const ex = exercises[exerciseIndex]
      if (!ex) continue
      const name = ex.replace(/\s+\d+x\d+$/, '').trim()
      if (seen.has(name)) continue
      const forImbalance = FLAG_IMBALANCE_CALLOUT[flag.id]
      seen.add(name)
      result.push({ ...toAcc(ex), forImbalance })
      addedInThisRound = true
      if (result.length >= targetCount) break
    }
    if (!addedInThisRound) break
    exerciseIndex += 1
  }

  if (result.length < targetCount) {
    const defaults = [toAcc('RDL 3x6'), toAcc('Glute bridge 3x8'), toAcc('Hamstring curl 3x10')]
    for (const d of defaults) {
      if (!seen.has(d.name) && result.length < targetCount) {
        result.push(d)
      }
    }
  }

  return result.slice(0, targetCount)
}

function oneLineDiagnosis(flags: RatioFlag[], confidence: ConfidenceLevel): string {
  const flagged = flags.filter((f) => !f.id.startsWith('typical_'))
  const soft = confidence === 'Medium' || confidence === 'Low' ? 'May indicate — ' : ''

  if (flagged.length === 0) {
    return confidence === 'High'
      ? 'Ratios within typical ranges — keep consistent training.'
      : 'Limited data — add more lifts for clearer ratio diagnostics.'
  }

  const first = flagged[0]
  if (first.id === 'deadlift_dominant')
    return `${soft}Deadlift dominant relative to squat — consider prioritising posterior-chain accessories.`
  if (first.id === 'squat_dominant')
    return `${soft}Squat dominant relative to deadlift — consider deadlift volume.`
  if (first.id === 'bench_dominant')
    return `${soft}Bench dominant relative to squat — consider prioritising lower-body work.`
  if (first.id === 'bench_lagging')
    return `${soft}Bench lagging relative to squat — consider horizontal push and triceps work.`
  if (first.id === 'press_weak')
    return `${soft}Overhead press lagging — consider shoulder stability and pressing volume.`
  if (first.id === 'press_strong')
    return `${soft}Press strong relative to bench.`
  if (first.id === 'squat_lagging_bench')
    return `${soft}Squat lagging relative to bench — consider prioritising lower-body work.`
  if (first.id === 'bench_lagging_squat')
    return `${soft}Bench lagging relative to squat — consider horizontal push and triceps work.`
  if (first.id === 'deadlift_lagging_bench')
    return `${soft}Deadlift lagging relative to bench — increase posterior-chain volume (aim ~6–10 hard sets/week of hinges/hamstrings for 4–6 weeks).`
  if (first.id === 'bench_lagging_deadlift')
    return `${soft}Bench lagging relative to deadlift — consider horizontal push work.`
  if (first.id === 'squat_lagging_press')
    return `${soft}Squat lagging relative to press — increase lower-body volume (aim ~8–14 hard sets/week quads+glutes; add ~2–4 sets/week if already training hard).`
  if (first.id === 'press_lagging_squat')
    return `${soft}Press lagging relative to squat — consider shoulder and pressing volume.`
  if (first.id === 'deadlift_lagging_press')
    return `${soft}Deadlift lagging relative to press — add posterior-chain work (aim ~6–10 hard sets/week hinges/hamstrings; or +2–4 sets/week if already doing it).`
  if (first.id === 'press_lagging_deadlift')
    return `${soft}Press lagging relative to deadlift — consider overhead pressing volume.`
  return first.message
}

/**
 * Full diagnostic. RULES.md §1–5.
 */
export function runDiagnostic(
  lifts: LiftInput[],
  form: Pick<FormState, 'bodyweight' | 'experience' | 'injury' | 'injury_notes'>
): DiagnosticResult {
  const oneRMs = compute1RMs(lifts)
  const ratios = computeRatios(oneRMs)
  const flags = generateFlags(ratios)
  const confidence = computeConfidence({
    lifts,
    bodyweight: form.bodyweight,
    experience: form.experience,
  })
  const oneLineDiagnosisText = oneLineDiagnosis(flags, confidence)
  const accessories = getAccessories(flags, form.injury, form.injury_notes, oneRMs)
  const liftPercentiles = computeLiftPercentiles(oneRMs, form.bodyweight, form.experience)

  return {
    oneRMs,
    ratios,
    flags,
    oneLineDiagnosis: oneLineDiagnosisText,
    accessories,
    confidence,
    liftPercentiles,
  }
}

// Legacy alias for tests
export const computeRatiosList = computeRatios
export const computeRatioFlags = generateFlags
