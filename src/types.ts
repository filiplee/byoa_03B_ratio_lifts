export type Units = 'kg' | 'lb'
export type Experience = 'Beginner' | 'Intermediate' | 'Advanced'
export type TrainingFrequency = '1-2' | '3-4' | '5+'
export type PrimaryGoal = 'Strength' | 'Hypertrophy' | 'Power' | 'Rehab'
export type LiftInputMethod = 'weight_reps' | 'one_rm'
export type Gender = 'male' | 'female' | 'prefer_not_to_say'

export const LIFT_IDS = ['squat', 'bench', 'deadlift', 'press'] as const
export type LiftId = (typeof LIFT_IDS)[number]

export const LIFT_NAMES: Record<LiftId, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  deadlift: 'Deadlift',
  press: 'Overhead Press',
}

export interface LiftInput {
  id: LiftId
  name: string
  method: LiftInputMethod
  weight?: number
  reps?: number
  one_rm?: number
}

export interface FormState {
  units: Units
  bodyweight?: number
  gender: Gender
  /** Required to generate a report; null until the user selects a strength level. */
  experience: Experience | null
  training_frequency: TrainingFrequency
  lifts: LiftInput[]
  primary_goal: PrimaryGoal
  injury: boolean
  injury_notes?: string
  equipment: string[]
}

/**
 * Coach workflow (e.g. athlete/coach names on PDFs, coach notes, roster / saved scenarios) is planned for a later phase.
 * Product copy: see the “Coaches” callout in `ResultCard`.
 */

export type OneRMMethod = 'epley' | 'user_provided'

export interface Lift1RM {
  id: LiftId
  name: string
  oneRM: number
  method: OneRMMethod
}

export type RatioFlagId =
  | 'bench_dominant'
  | 'typical_bench_squat'
  | 'bench_lagging'
  | 'deadlift_dominant'
  | 'typical_squat_deadlift'
  | 'squat_dominant'
  | 'press_weak'
  | 'typical_press_bench'
  | 'press_strong'
  // Lower-to-upper cross-body
  | 'squat_lagging_bench'
  | 'typical_squat_bench'
  | 'bench_lagging_squat'
  | 'deadlift_lagging_bench'
  | 'typical_deadlift_bench'
  | 'bench_lagging_deadlift'
  | 'squat_lagging_press'
  | 'typical_squat_press'
  | 'press_lagging_squat'
  | 'deadlift_lagging_press'
  | 'typical_deadlift_press'
  | 'press_lagging_deadlift'

export interface RatioFlag {
  id: RatioFlagId
  ratio: number
  label: string
  message: string
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low'

/** Population percentile band (same labels at every experience tier; tier shifts thresholds). */
export type StrengthBand =
  | 'Getting Started'
  | 'Developing'
  | 'Solid'
  | 'Strong'
  | 'Elite'

export interface AccessoryExercise {
  name: string
  setsReps: string
  cue?: string
  /** Suggested working weight (e.g. 60% of related 1RM) */
  suggestedWeight?: number
  /** Which imbalance this recommendation addresses (e.g. "Press overweighted relative to bench") */
  forImbalance?: string
}

export interface LiftPercentile {
  id: LiftId
  name: string
  ratioBW: number
  percentile: number
  band: StrengthBand
  /** Where this lift would rank against the next stricter cohort (Beginner → Intermediate, Intermediate → Advanced). */
  projectedNextTierPercentile?: number
  projectedNextTierStandardsName?: 'Intermediate' | 'Advanced'
}

export interface DiagnosticResult {
  oneRMs: Lift1RM[]
  ratios: { id: string; label: string; value: number }[]
  flags: RatioFlag[]
  oneLineDiagnosis: string
  accessories: AccessoryExercise[]
  confidence: ConfidenceLevel
  heroScore: {
    displayedScore: number // 1–100, raw minus penalty
    rawPercentile: number // before penalty
    balancePenalty: number // 0–20
    weakestLift: string | null // name of lift furthest below mean
    penaltyPoints: number // points that lift is costing
    band: StrengthBand
  }
  /** Lift percentiles (ratio × bodyweight vs population). Requires bodyweight. */
  liftPercentiles?: LiftPercentile[]
  /**
   * Average projected percentile vs the next experience standard (cohort comparison).
   * Shown when experience is Beginner or Intermediate.
   */
  secondaryPercentile?: {
    percentile: number
    /** e.g. "INTERMEDIATE STANDARDS" */
    standardsLabel: string
  }
}

/** Saved athlete scenarios for coaches — implementation deferred to the coach phase. */
export interface SavedAthleteScenario {
  id: string
  athleteName: string
  savedAt: string // ISO date
  primaryImbalance: string | null // first non-typical flag label or null
  form: FormState
  result: DiagnosticResult
}

export interface DiagnosticInputs {
  lifts: LiftInput[]
  bodyweight?: number
  gender: Gender
  experience: Experience | null
  units: Units
  injury: boolean
  injury_notes?: string
}
