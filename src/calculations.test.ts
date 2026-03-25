import { describe, it, expect } from 'vitest'
import {
  epley1RM,
  compute1RM,
  compute1RMs,
  generateFlags,
  computeRatios,
  computeConfidence,
  runDiagnostic,
  calculatePercentile,
} from './calculations'
import type { LiftInput } from './types'

describe('epley1RM', () => {
  it('computes 1RM from weight and reps', () => {
    expect(epley1RM(120, 3)).toBe(132)
    expect(epley1RM(90, 5)).toBe(105)
    expect(epley1RM(160, 3)).toBe(176)
    expect(epley1RM(55, 5)).toBe(64.2)
  })

  it('returns 0 for invalid inputs', () => {
    expect(epley1RM(0, 5)).toBe(0)
    expect(epley1RM(90, 0)).toBe(0)
  })
})

describe('compute1RM', () => {
  it('returns epley for weight_reps', () => {
    const r = compute1RM({
      id: 'squat',
      name: 'Squat',
      method: 'weight_reps',
      weight: 120,
      reps: 3,
    })
    expect(r).toEqual({ oneRM: 132, method: 'epley' })
  })

  it('returns user_provided for one_rm', () => {
    const r = compute1RM({
      id: 'squat',
      name: 'Squat',
      method: 'one_rm',
      one_rm: 130,
    })
    expect(r).toEqual({ oneRM: 130, method: 'user_provided' })
  })

  it('returns null for invalid', () => {
    expect(compute1RM({ id: 'squat', name: 'Squat', method: 'weight_reps', weight: 0, reps: 5 })).toBeNull()
  })
})

describe('compute1RMs', () => {
  const sampleLifts: LiftInput[] = [
    { id: 'squat', name: 'Squat', method: 'weight_reps', weight: 120, reps: 3 },
    { id: 'bench', name: 'Bench Press', method: 'weight_reps', weight: 90, reps: 5 },
    { id: 'deadlift', name: 'Deadlift', method: 'weight_reps', weight: 160, reps: 3 },
    { id: 'press', name: 'Overhead Press', method: 'weight_reps', weight: 55, reps: 5 },
  ]

  it('returns Epley 1RMs for weight_reps inputs', () => {
    const result = compute1RMs(sampleLifts)
    expect(result).toHaveLength(4)
    expect(result.find((r) => r.id === 'squat')?.oneRM).toBe(132)
    expect(result.find((r) => r.id === 'bench')?.oneRM).toBe(105)
    expect(result.find((r) => r.id === 'deadlift')?.oneRM).toBe(176)
    expect(result.find((r) => r.id === 'press')?.oneRM).toBe(64.2)
    expect(result.every((r) => r.method === 'epley')).toBe(true)
  })

  it('uses user_provided when method is one_rm', () => {
    const lifts: LiftInput[] = [{ id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 130 }]
    const result = compute1RMs(lifts)
    expect(result).toHaveLength(1)
    expect(result[0].oneRM).toBe(130)
    expect(result[0].method).toBe('user_provided')
  })

  it('skips lifts with missing or invalid data', () => {
    const lifts: LiftInput[] = [
      { id: 'squat', name: 'Squat', method: 'weight_reps', weight: 0, reps: 5 },
      { id: 'bench', name: 'Bench', method: 'weight_reps', weight: 90, reps: 5 },
    ]
    const result = compute1RMs(lifts)
    expect(result).toHaveLength(1)
    expect(result[0].oneRM).toBe(105)
  })
})

describe('computeRatios', () => {
  it('computes bench_to_squat, squat_to_deadlift, press_to_bench and lower-to-upper ratios (2 decimals)', () => {
    const oneRMs = [
      { id: 'squat' as const, name: 'Squat', oneRM: 132, method: 'epley' as const },
      { id: 'bench' as const, name: 'Bench', oneRM: 105, method: 'epley' as const },
      { id: 'deadlift' as const, name: 'Deadlift', oneRM: 176, method: 'epley' as const },
      { id: 'press' as const, name: 'Press', oneRM: 64.2, method: 'epley' as const },
    ]
    const ratios = computeRatios(oneRMs)
    expect(ratios).toHaveLength(7)
    expect(ratios.find((r) => r.id === 'bench_to_squat')?.value).toBe(0.8)
    expect(ratios.find((r) => r.id === 'squat_to_deadlift')?.value).toBe(0.75)
    expect(ratios.find((r) => r.id === 'press_to_bench')?.value).toBe(0.61)
    expect(ratios.find((r) => r.id === 'squat_to_bench')?.value).toBe(1.26)
    expect(ratios.find((r) => r.id === 'deadlift_to_bench')?.value).toBe(1.68)
    expect(ratios.find((r) => r.id === 'squat_to_press')?.value).toBe(2.06)
    expect(ratios.find((r) => r.id === 'deadlift_to_press')?.value).toBe(2.74)
  })
})

describe('generateFlags', () => {
  it('flags deadlift_dominant when squat_to_deadlift < 0.8', () => {
    const ratios = [
      { id: 'squat_to_deadlift', label: 'Squat : Deadlift', value: 0.75 },
    ]
    const flags = generateFlags(ratios)
    expect(flags.some((f) => f.id === 'deadlift_dominant')).toBe(true)
  })

  it('typical_bench_squat when 0.45–1.10', () => {
    const ratios = [{ id: 'bench_to_squat', label: 'Bench : Squat', value: 0.8 }]
    const flags = generateFlags(ratios)
    expect(flags.some((f) => f.id === 'typical_bench_squat')).toBe(true)
  })

  it('bench_lagging when < 0.45', () => {
    const ratios = [{ id: 'bench_to_squat', label: 'Bench : Squat', value: 0.4 }]
    const flags = generateFlags(ratios)
    expect(flags.some((f) => f.id === 'bench_lagging')).toBe(true)
  })

  it('press_weak when < 0.35', () => {
    const ratios = [{ id: 'press_to_bench', label: 'Press : Bench', value: 0.3 }]
    const flags = generateFlags(ratios)
    expect(flags.some((f) => f.id === 'press_weak')).toBe(true)
  })
})

describe('computeConfidence', () => {
  const fullLifts: LiftInput[] = [
    { id: 'squat', name: 'Squat', method: 'weight_reps', weight: 120, reps: 3 },
    { id: 'bench', name: 'Bench', method: 'weight_reps', weight: 90, reps: 5 },
    { id: 'deadlift', name: 'Deadlift', method: 'weight_reps', weight: 160, reps: 3 },
    { id: 'press', name: 'Press', method: 'weight_reps', weight: 55, reps: 5 },
  ]

  it('High when 4 lifts + bodyweight + experience', () => {
    expect(
      computeConfidence({ lifts: fullLifts, bodyweight: 78, experience: 'Intermediate' })
    ).toBe('High')
  })

  it('Medium when 2–3 lifts', () => {
    expect(
      computeConfidence({
        lifts: fullLifts.slice(0, 2),
        experience: 'Intermediate',
      })
    ).toBe('Medium')
  })

  it('Low when 1 lift only', () => {
    expect(
      computeConfidence({
        lifts: fullLifts.slice(0, 1),
        experience: 'Intermediate',
      })
    ).toBe('Low')
  })
})

describe('runDiagnostic (sample input)', () => {
  const sampleLifts: LiftInput[] = [
    { id: 'squat', name: 'Squat', method: 'weight_reps', weight: 120, reps: 3 },
    { id: 'bench', name: 'Bench Press', method: 'weight_reps', weight: 90, reps: 5 },
    { id: 'deadlift', name: 'Deadlift', method: 'weight_reps', weight: 160, reps: 3 },
    { id: 'press', name: 'Overhead Press', method: 'weight_reps', weight: 55, reps: 5 },
  ]

  it('produces expected 1RMs and ratios', () => {
    const result = runDiagnostic(sampleLifts, {
      bodyweight: 78,
      gender: 'prefer_not_to_say',
      experience: 'Intermediate',
      injury: false,
      training_frequency: '3-4',
    })
    expect(result.oneRMs).toHaveLength(4)
    expect(result.oneRMs.find((r) => r.id === 'squat')?.oneRM).toBe(132)
    expect(result.oneRMs.find((r) => r.id === 'deadlift')?.oneRM).toBe(176)
    expect(result.ratios.find((r) => r.id === 'squat_to_deadlift')?.value).toBe(0.75)
    expect(result.ratios.find((r) => r.id === 'bench_to_squat')?.value).toBe(0.8)
    expect(result.ratios.find((r) => r.id === 'press_to_bench')?.value).toBe(0.61)
  })

  it('includes deadlift_dominant flag and posterior-chain accessories', () => {
    const result = runDiagnostic(sampleLifts, {
      bodyweight: 78,
      gender: 'prefer_not_to_say',
      experience: 'Intermediate',
      injury: false,
      training_frequency: '3-4',
    })
    expect(result.flags.some((f) => f.id === 'deadlift_dominant')).toBe(true)
    expect(result.oneLineDiagnosis).toContain('Deadlift dominant')
    expect(result.accessories).toHaveLength(3)
    expect(result.accessories[0].name).toBe('RDL')
  })

  it('returns no accessories with fewer than two lifts', () => {
    const lifts: LiftInput[] = [{ id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 100 }]
    const result = runDiagnostic(lifts, {
      bodyweight: 80,
      gender: 'male',
      experience: 'Intermediate',
      injury: false,
      training_frequency: '3-4',
    })
    expect(result.accessories).toHaveLength(0)
  })

  it('returns no accessories when all ratios are typical (no generic fallback)', () => {
    const lifts: LiftInput[] = [
      { id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 100 },
      { id: 'bench', name: 'Bench Press', method: 'one_rm', one_rm: 75 },
    ]
    const result = runDiagnostic(lifts, {
      bodyweight: 80,
      gender: 'male',
      experience: 'Intermediate',
      injury: false,
      training_frequency: '3-4',
    })
    expect(result.flags.every((f) => f.id.startsWith('typical_'))).toBe(true)
    expect(result.accessories).toHaveLength(0)
  })

  it('prioritises lower-body accessories when deadlift/squat lagging alongside press_strong', () => {
    // PDF scenario: squat 93.3, bench 93.3, deadlift 105, press 58.3
    // → press_strong, deadlift_lagging_bench, squat_lagging_press, deadlift_lagging_press
    const pdfLifts: LiftInput[] = [
      { id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 93.3 },
      { id: 'bench', name: 'Bench Press', method: 'one_rm', one_rm: 93.3 },
      { id: 'deadlift', name: 'Deadlift', method: 'one_rm', one_rm: 105 },
      { id: 'press', name: 'Overhead Press', method: 'one_rm', one_rm: 58.3 },
    ]
    const result = runDiagnostic(pdfLifts, {
      bodyweight: 73,
      gender: 'prefer_not_to_say',
      experience: 'Intermediate',
      injury: false,
      training_frequency: '3-4',
    })
    expect(result.flags.some((f) => f.id === 'press_strong')).toBe(true)
    expect(result.flags.some((f) => f.id === 'deadlift_lagging_bench')).toBe(true)
    expect(result.flags.some((f) => f.id === 'squat_lagging_press')).toBe(true)
    // Top 3 should include posterior-chain / lower-body work, not just bench/triceps
    const accessoryNames = result.accessories.map((a) => a.name)
    expect(accessoryNames).toContain('RDL')
    expect(accessoryNames.some((n) => ['RDL', 'Glute bridge', 'Hamstring curl', 'Squat strength', 'Lower-body volume', 'Romanian deadlift'].includes(n))).toBe(true)
  })
})

describe('runDiagnostic guards', () => {
  it('throws when experience is missing', () => {
    const lifts: LiftInput[] = [
      { id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 100 },
      { id: 'bench', name: 'Bench Press', method: 'one_rm', one_rm: 80 },
    ]
    expect(() =>
      runDiagnostic(lifts, {
        bodyweight: 80,
        gender: 'male',
        experience: null,
        injury: false,
        training_frequency: '3-4',
      }),
    ).toThrow(/experience/)
  })
})

describe('calculatePercentile', () => {
  it('returns higher cohort percentile for Beginner than Advanced on same lift', () => {
    const beginner = calculatePercentile('Squat', 100, 70, 'Male', 'Beginner')
    const advanced = calculatePercentile('Squat', 100, 70, 'Male', 'Advanced')
    expect(beginner.percentile).toBeGreaterThan(advanced.percentile)
    expect(beginner.projectedAtAdvanced).toBe(advanced.percentile)
  })
})

describe('hero score (van den Hoek + Kilgore)', () => {
  it('80kg male example stays low-percentile with small penalty (Intermediate cohort)', () => {
    const lifts: LiftInput[] = [
      { id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 120 },
      { id: 'bench', name: 'Bench Press', method: 'one_rm', one_rm: 80 },
      { id: 'deadlift', name: 'Deadlift', method: 'one_rm', one_rm: 150 },
      { id: 'press', name: 'Overhead Press', method: 'one_rm', one_rm: 55 },
    ]

    const result = runDiagnostic(lifts, {
      bodyweight: 80,
      gender: 'male',
      experience: 'Intermediate',
      injury: false,
      training_frequency: '3-4',
    })

    expect(['Getting Started', 'Developing']).toContain(result.heroScore.band)
    expect(result.heroScore.displayedScore).toBeLessThan(45)
    expect(result.heroScore.balancePenalty).toBeGreaterThanOrEqual(0)
    expect(result.heroScore.balancePenalty).toBeLessThanOrEqual(12)
  })

  it('Balanced at Advanced p50 (83kg class midpoint) has minimal penalty', () => {
    const bodyweight = 83
    const lifts: LiftInput[] = [
      { id: 'squat', name: 'Squat', method: 'one_rm', one_rm: 2.29 * bodyweight },
      { id: 'bench', name: 'Bench Press', method: 'one_rm', one_rm: 1.56 * bodyweight },
      { id: 'deadlift', name: 'Deadlift', method: 'one_rm', one_rm: 2.68 * bodyweight },
      { id: 'press', name: 'Overhead Press', method: 'one_rm', one_rm: 0.65 * bodyweight },
    ]

    const result = runDiagnostic(lifts, {
      bodyweight,
      gender: 'male',
      experience: 'Advanced',
      injury: false,
      training_frequency: '3-4',
    })

    expect(result.heroScore.balancePenalty).toBeLessThanOrEqual(2)
    expect(result.heroScore.displayedScore).toBeGreaterThanOrEqual(47)
    expect(result.heroScore.displayedScore).toBeLessThanOrEqual(52)
    expect(result.heroScore.band).toBe('Solid')
  })
})
