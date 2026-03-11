/**
 * Example unit tests for report-validation module.
 * Run: node --experimental-vm-modules node_modules/vitest/vitest.mjs run report-validation.test.js
 * Or: npx vitest run src/pdf-template/report-validation.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  compute1RM,
  computeRatios,
  generateFlags,
  computeConfidence,
  validateConsistency,
  validateUnits,
  getValidationHints,
} from './report-validation.js';

describe('compute1RM', () => {
  it('computes Epley for weight_reps', () => {
    const r = compute1RM({ method: 'weight_reps', weight: 80, reps: 3 });
    expect(r).toEqual({ oneRM: 88, method: 'epley', trace: '80 × 3 → Epley → 88' });
  });

  it('returns user_provided for one_rm', () => {
    const r = compute1RM({ method: 'one_rm', one_rm: 100 });
    expect(r).toEqual({ oneRM: 100, method: 'user_provided', trace: '100 (provided) → 100' });
  });

  it('returns null for invalid input', () => {
    expect(compute1RM({ method: 'weight_reps', weight: 0, reps: 5 })).toBeNull();
    expect(compute1RM({ method: 'one_rm' })).toBeNull();
  });

  it('rounds to 1 decimal', () => {
    const r = compute1RM({ method: 'weight_reps', weight: 60, reps: 5 });
    expect(r.oneRM).toBe(70);
  });
});

describe('computeRatios', () => {
  it('computes bench_to_squat, squat_to_deadlift, press_to_bench and lower-to-upper ratios (2 decimals)', () => {
    const ratios = computeRatios({ squat: 88, bench: 70, deadlift: 99, press: 58.3 });
    expect(ratios.length).toBeGreaterThanOrEqual(3);
    expect(ratios.find((r) => r.id === 'bench_to_squat').value).toBe(0.8);
    expect(ratios.find((r) => r.id === 'squat_to_deadlift').value).toBe(0.89);
    expect(ratios.find((r) => r.id === 'press_to_bench').value).toBe(0.83);
    expect(ratios.find((r) => r.id === 'squat_to_bench').value).toBe(1.26);
    expect(ratios.find((r) => r.id === 'deadlift_to_bench').value).toBe(1.41);
    expect(ratios.find((r) => r.id === 'squat_to_press').value).toBe(1.51);
    expect(ratios.find((r) => r.id === 'deadlift_to_press').value).toBe(1.7);
  });

  it('bench > squat yields ratio > 1', () => {
    const ratios = computeRatios({ squat: 70, bench: 88 });
    expect(ratios.find((r) => r.id === 'bench_to_squat').value).toBeGreaterThan(1);
  });

  it('only computes when both lifts exist', () => {
    const ratios = computeRatios({ squat: 88 });
    expect(ratios).toHaveLength(0);
  });
});

describe('generateFlags', () => {
  it('bench_dominant when bench_to_squat > 1.10', () => {
    const flags = generateFlags([{ id: 'bench_to_squat', value: 1.2 }]);
    expect(flags[0].id).toBe('bench_dominant');
  });

  it('bench_lagging when bench_to_squat < 0.45', () => {
    const flags = generateFlags([{ id: 'bench_to_squat', value: 0.4 }]);
    expect(flags[0].id).toBe('bench_lagging');
  });

  it('typical when in range', () => {
    const flags = generateFlags([{ id: 'bench_to_squat', value: 0.8 }]);
    expect(flags[0].id).toBe('typical_bench_squat');
  });

  it('deadlift_dominant when squat_to_deadlift < 0.80', () => {
    const flags = generateFlags([{ id: 'squat_to_deadlift', value: 0.75 }]);
    expect(flags[0].id).toBe('deadlift_dominant');
  });

  it('squat_deadlift parity (0.98–1.02) yields typical', () => {
    const flags = generateFlags([{ id: 'squat_to_deadlift', value: 1.0 }]);
    expect(flags[0].id).toBe('typical_squat_deadlift');
  });
});

describe('computeConfidence', () => {
  it('High when 4 lifts + bodyweight + experience', () => {
    const c = computeConfidence({
      computed_1rms: [{}, {}, {}, {}],
      bodyweight: 72,
      experience: 'Intermediate',
    });
    expect(c).toBe('High');
  });

  it('Medium when 2–3 lifts', () => {
    const c = computeConfidence({
      computed_1rms: [{}, {}],
      experience: 'Intermediate',
    });
    expect(c).toBe('Medium');
  });

  it('Low when only one lift', () => {
    const c = computeConfidence({
      computed_1rms: [{}],
      experience: 'Intermediate',
    });
    expect(c).toBe('Low');
  });

  it('Low when experience missing', () => {
    const c = computeConfidence({
      computed_1rms: [{}, {}],
      experience: '',
    });
    expect(c).toBe('Low');
  });
});

describe('validateConsistency', () => {
  it('returns error when primary flag present but diagnosis does not mention it', () => {
    const result = validateConsistency(
      {},
      {
        flags: [{ id: 'bench_lagging', label: 'Bench : Squat', value: 0.4, message: 'x' }],
        one_line_diagnosis: 'Deadlift dominant', // contradicts: primary flag is bench_lagging
      }
    );
    expect(result.error).toContain('bench_lagging');
  });

  it('passes when diagnosis matches primary flag', () => {
    const result = validateConsistency(
      {},
      {
        flags: [{ id: 'bench_lagging', label: 'Bench : Squat', value: 0.4, message: 'x' }],
        one_line_diagnosis: 'Bench lagging relative to squat.',
      }
    );
    expect(result.error).toBeUndefined();
  });

  it('returns hints for <2 lifts', () => {
    const result = validateConsistency(
      {},
      { computed_1rms: [{}], flags: [], one_line_diagnosis: 'Limited data.' }
    );
    expect(result.hints?.missing_lifts_banner).toBe('Add more lifts to unlock ratio diagnostics.');
  });

  it('returns warmup_hint when reps>10 and weight<0.5*bodyweight', () => {
    const result = validateConsistency(
      { lifts: [{ method: 'weight_reps', weight: 30, reps: 12 }], bodyweight: 80 },
      { flags: [], one_line_diagnosis: 'x' }
    );
    expect(result.hints?.warmup_hint).toBe('Check input — is this a warmup?');
  });

  it('returns squat_deadlift_parity_note when abs(ratio - 1.0) <= 0.02', () => {
    const result = validateConsistency(
      {},
      {
        ratios: [{ id: 'squat_to_deadlift', value: 1.0 }],
        flags: [],
        one_line_diagnosis: 'x',
      }
    );
    expect(result.hints?.squat_deadlift_parity_note).toContain('nearly equal');
  });

  it('returns squat_dominant_diagnosis_warning when squat_to_deadlift > 1.0 and diagnosis does not recommend deadlift', () => {
    const result = validateConsistency(
      {},
      {
        ratios: [{ id: 'squat_to_deadlift', value: 1.05 }],
        flags: [{ id: 'squat_dominant', label: 'Squat : Deadlift', value: 1.05, message: 'x' }],
        one_line_diagnosis: 'Squat dominant — keep training upper body.', // passes consistency, no deadlift rec
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.hints?.squat_dominant_diagnosis_warning).toBeDefined();
    expect(result.hints.squat_dominant_diagnosis_warning).toContain('deadlift');
  });

  it('does not return squat_dominant_diagnosis_warning when diagnosis recommends deadlift', () => {
    const result = validateConsistency(
      {},
      {
        ratios: [{ id: 'squat_to_deadlift', value: 1.05 }],
        flags: [{ id: 'squat_dominant', label: 'Squat : Deadlift', value: 1.05, message: 'x' }],
        one_line_diagnosis: 'Squat dominant — consider deadlift volume and technique.',
      }
    );
    expect(result.hints?.squat_dominant_diagnosis_warning).toBeUndefined();
  });
});

describe('validateUnits', () => {
  it('passes for kg and lb', () => {
    expect(validateUnits({ units: 'kg' }).error).toBeUndefined();
    expect(validateUnits({ units: 'lb' }).error).toBeUndefined();
  });

  it('returns error for invalid units', () => {
    expect(validateUnits({ units: 'lbs' }).error).toContain('Invalid units');
  });

  it('returns error for mixed units (implicit)', () => {
    expect(validateUnits({ units: 'oz' }).error).toBeDefined();
  });
});

describe('getValidationHints', () => {
  it('returns empty when no hints apply', () => {
    const hints = getValidationHints({
      computed_1rms: [{}, {}, {}, {}],
      bodyweight: 72,
      lifts: [{ method: 'weight_reps', weight: 80, reps: 3 }],
      flags: [],
      one_line_diagnosis: 'x',
    });
    expect(hints.missing_lifts_banner).toBeUndefined();
    expect(hints.warmup_hint).toBeUndefined();
  });
});
