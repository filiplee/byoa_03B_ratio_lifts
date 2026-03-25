/**
 * Stratified strength standards for percentile lookup.
 * Advanced tier: van den Hoek et al. (2024) IPF ratios (squat/bench/deadlift) +
 * Kilgore-style OHP anchors (press). Beginner/Intermediate tiers scale Advanced
 * thresholds by 0.60 and 0.80 respectively (Kilgore progression heuristic).
 */

import { VAN_DEN_HOEK_THRESHOLDS } from './van_den_hoek_thresholds'
import type { Gender } from '../types'

export type StrengthStandardExercise = 'Squat' | 'Bench Press' | 'Deadlift' | 'Overhead Press'
export type StrengthStandardSex = 'Male' | 'Female'

export interface StrengthStandardRow {
  exercise: StrengthStandardExercise
  sex: StrengthStandardSex
  /** e.g. "[80-89]" — 10 kg brackets (open-ended for heaviest class). */
  bodyweightRange: string
  /** Population percentile → minimum BW ratio (×BW) at or above that percentile. */
  percentiles: Record<number, number>
}

export type PercentileAnchors = {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

const KILGORE_OHP_ANCHORS: Record<'male' | 'female', PercentileAnchors> = {
  male: { p10: 0.35, p25: 0.5, p50: 0.65, p75: 0.8, p90: 1.0 },
  female: { p10: 0.2, p25: 0.3, p50: 0.4, p75: 0.52, p90: 0.65 },
}

type VanLift = 'squat' | 'bench' | 'deadlift'
const VAN_TABLE = VAN_DEN_HOEK_THRESHOLDS as unknown as Record<
  'male' | 'female',
  Record<number | 'open', Record<VanLift, PercentileAnchors>>
>

const EXERCISE_TO_VAN: Record<Exclude<StrengthStandardExercise, 'Overhead Press'>, VanLift> = {
  Squat: 'squat',
  'Bench Press': 'bench',
  Deadlift: 'deadlift',
}

const PERCENTILE_SAMPLE = [
  1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99,
] as const

function getIPFWeightClass(bodyweightKg: number, g: 'male' | 'female'): number | 'open' {
  const maleClasses = [53, 59, 66, 74, 83, 93, 105, 120]
  const femaleClasses = [43, 47, 52, 57, 63, 69, 76, 84]
  const classes = g === 'male' ? maleClasses : femaleClasses
  const match = classes.find((c) => bodyweightKg <= c)
  return (match ?? 'open') as number | 'open'
}

function scaleAnchors(a: PercentileAnchors, factor: number): PercentileAnchors {
  return {
    p10: a.p10 * factor,
    p25: a.p25 * factor,
    p50: a.p50 * factor,
    p75: a.p75 * factor,
    p90: a.p90 * factor,
  }
}

/**
 * Forward map: population percentile (0–100) → typical BW ratio at that percentile,
 * piecewise linear through p10/p25/p50/p75/p90 (aligned with interpolatePercentile in calculations).
 */
export function ratioAtPopulationPercentile(anchors: PercentileAnchors, percentile: number): number {
  const p = Math.max(0, Math.min(100, percentile))
  const { p10, p25, p50, p75, p90 } = anchors

  if (p <= 10) {
    return p10 * (p / 10)
  }
  if (p <= 25) {
    const t = (p - 10) / 15
    return p10 + t * (p25 - p10)
  }
  if (p <= 50) {
    const t = (p - 25) / 25
    return p25 + t * (p50 - p25)
  }
  if (p <= 75) {
    const t = (p - 50) / 25
    return p50 + t * (p75 - p50)
  }
  if (p <= 90) {
    const t = (p - 75) / 15
    return p75 + t * (p90 - p75)
  }
  const slope = (p90 - p75) / 15
  return p90 + (p - 90) * slope
}

function anchorsToPercentileMap(anchors: PercentileAnchors): Record<number, number> {
  const out: Record<number, number> = {}
  for (const pct of PERCENTILE_SAMPLE) {
    const r = ratioAtPopulationPercentile(anchors, pct)
    out[pct] = Math.round(r * 1000) / 1000
  }
  return out
}

function advancedAnchorsForLift(
  exercise: StrengthStandardExercise,
  sex: 'male' | 'female',
  bodyweightKg: number
): PercentileAnchors {
  if (exercise === 'Overhead Press') {
    return KILGORE_OHP_ANCHORS[sex]
  }
  const vanLift = EXERCISE_TO_VAN[exercise]
  const wc = getIPFWeightClass(bodyweightKg, sex)
  return VAN_TABLE[sex][wc][vanLift]
}

/** Runtime lookup: scaled anchors for experience tier (comparison baseline). */
export function getAnchorsForLiftAndExperience(
  liftId: 'squat' | 'bench' | 'deadlift' | 'press',
  gender: Gender,
  bodyweightKg: number,
  tier: 'Beginner' | 'Intermediate' | 'Advanced'
): PercentileAnchors {
  const sex: 'male' | 'female' = gender === 'female' ? 'female' : 'male'
  const exercise: StrengthStandardExercise =
    liftId === 'squat'
      ? 'Squat'
      : liftId === 'bench'
        ? 'Bench Press'
        : liftId === 'deadlift'
          ? 'Deadlift'
          : 'Overhead Press'

  const base = advancedAnchorsForLift(exercise, sex, bodyweightKg)
  const factor = tier === 'Advanced' ? 1 : tier === 'Intermediate' ? 0.8 : 0.6
  return scaleAnchors(base, factor)
}

type Bracket = { range: string; midKg: number }

const MALE_BRACKETS: Bracket[] = [
  { range: '[50-59]', midKg: 55 },
  { range: '[60-69]', midKg: 65 },
  { range: '[70-79]', midKg: 75 },
  { range: '[80-89]', midKg: 85 },
  { range: '[90-99]', midKg: 95 },
  { range: '[100-109]', midKg: 105 },
  { range: '[110-119]', midKg: 115 },
  { range: '[120+]', midKg: 125 },
]

const FEMALE_BRACKETS: Bracket[] = [
  { range: '[43-49]', midKg: 46 },
  { range: '[50-59]', midKg: 55 },
  { range: '[60-69]', midKg: 65 },
  { range: '[70-79]', midKg: 75 },
  { range: '[80-89]', midKg: 85 },
  { range: '[90-99]', midKg: 95 },
  { range: '[100+]', midKg: 105 },
]

const ALL_EXERCISES: StrengthStandardExercise[] = [
  'Squat',
  'Bench Press',
  'Deadlift',
  'Overhead Press',
]

function buildTierTable(scale: number): StrengthStandardRow[] {
  const rows: StrengthStandardRow[] = []

  for (const b of MALE_BRACKETS) {
    for (const exercise of ALL_EXERCISES) {
      const base = advancedAnchorsForLift(exercise, 'male', b.midKg)
      rows.push({
        exercise,
        sex: 'Male',
        bodyweightRange: b.range,
        percentiles: anchorsToPercentileMap(scaleAnchors(base, scale)),
      })
    }
  }

  for (const b of FEMALE_BRACKETS) {
    for (const exercise of ALL_EXERCISES) {
      const base = advancedAnchorsForLift(exercise, 'female', b.midKg)
      rows.push({
        exercise,
        sex: 'Female',
        bodyweightRange: b.range,
        percentiles: anchorsToPercentileMap(scaleAnchors(base, scale)),
      })
    }
  }

  return rows
}

/** van den Hoek (2024) + Kilgore OHP, full IPF-style stratification. */
export const STRENGTH_STANDARDS_ADVANCED: readonly StrengthStandardRow[] = buildTierTable(1)

/** 80% of Advanced thresholds. */
export const STRENGTH_STANDARDS_INTERMEDIATE: readonly StrengthStandardRow[] = buildTierTable(0.8)

/** 60% of Advanced thresholds. */
export const STRENGTH_STANDARDS_BEGINNER: readonly StrengthStandardRow[] = buildTierTable(0.6)
