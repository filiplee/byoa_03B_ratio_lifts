/**
 * Pre-generate validation module for Ratio Lifts PDF report.
 * Exports: compute1RM, computeRatios, generateFlags, computeConfidence, validateConsistency.
 * Blocks PDF generation if diagnosis contradicts flags.
 */

const ROUND_1 = (n) => Math.round(n * 10) / 10;
const ROUND_2 = (n) => Math.round(n * 100) / 100;

/**
 * Epley: 1RM = weight * (1 + reps/30). Round to 1 decimal.
 * @param {Object} input - { method, weight?, reps?, one_rm?, input_source? }
 * @returns {{ oneRM: number, method: 'epley'|'user_provided', trace: string } | null}
 */
function compute1RM(input) {
  if (input.method === 'one_rm' && typeof input.one_rm === 'number' && input.one_rm > 0) {
    return {
      oneRM: ROUND_1(input.one_rm),
      method: 'user_provided',
      trace: `${input.one_rm} (provided) → ${ROUND_1(input.one_rm)}`,
    };
  }
  if (
    input.method === 'weight_reps' &&
    typeof input.weight === 'number' &&
    input.weight > 0 &&
    typeof input.reps === 'number' &&
    input.reps >= 1 &&
    input.reps <= 20
  ) {
    const oneRM = ROUND_1(input.weight * (1 + input.reps / 30));
    return {
      oneRM,
      method: 'epley',
      trace: `${input.weight} × ${input.reps} → Epley → ${oneRM}`,
    };
  }
  return null;
}

/**
 * Compute ratios from 1RM map. Only when both lifts exist. Display 2 decimals.
 * bench_to_squat = bench1RM/squat1RM; squat_to_deadlift = squat1RM/deadlift1RM; press_to_bench = press1RM/bench1RM
 * @param {Object} oneRMByLift - { squat?, bench?, deadlift?, press? }
 * @returns {Array<{ id: string, label: string, value: number }>}
 */
function computeRatios(oneRMByLift) {
  const out = [];
  if (oneRMByLift.bench != null && oneRMByLift.squat != null && oneRMByLift.squat > 0) {
    out.push({
      id: 'bench_to_squat',
      label: 'Bench : Squat',
      value: ROUND_2(oneRMByLift.bench / oneRMByLift.squat),
    });
  }
  if (oneRMByLift.squat != null && oneRMByLift.deadlift != null && oneRMByLift.deadlift > 0) {
    out.push({
      id: 'squat_to_deadlift',
      label: 'Squat : Deadlift',
      value: ROUND_2(oneRMByLift.squat / oneRMByLift.deadlift),
    });
  }
  if (oneRMByLift.press != null && oneRMByLift.bench != null && oneRMByLift.bench > 0) {
    out.push({
      id: 'press_to_bench',
      label: 'Press : Bench',
      value: ROUND_2(oneRMByLift.press / oneRMByLift.bench),
    });
  }
  if (oneRMByLift.squat != null && oneRMByLift.bench != null && oneRMByLift.bench > 0) {
    out.push({ id: 'squat_to_bench', label: 'Squat : Bench', value: ROUND_2(oneRMByLift.squat / oneRMByLift.bench) });
  }
  if (oneRMByLift.deadlift != null && oneRMByLift.bench != null && oneRMByLift.bench > 0) {
    out.push({ id: 'deadlift_to_bench', label: 'Deadlift : Bench', value: ROUND_2(oneRMByLift.deadlift / oneRMByLift.bench) });
  }
  if (oneRMByLift.squat != null && oneRMByLift.press != null && oneRMByLift.press > 0) {
    out.push({ id: 'squat_to_press', label: 'Squat : Press', value: ROUND_2(oneRMByLift.squat / oneRMByLift.press) });
  }
  if (oneRMByLift.deadlift != null && oneRMByLift.press != null && oneRMByLift.press > 0) {
    out.push({ id: 'deadlift_to_press', label: 'Deadlift : Press', value: ROUND_2(oneRMByLift.deadlift / oneRMByLift.press) });
  }
  return out;
}

/**
 * Generate flags from ratios. Thresholds:
 * Bench:Squat >1.10=>bench_dominant; 0.45–1.10=>typical; <0.45=>bench_lagging
 * Squat:Deadlift <0.80=>deadlift_dominant; 0.80–1.00=>typical; >1.00=>squat_dominant
 * Press:Bench <0.35=>press_weak; 0.35–0.45=>typical; >0.45=>press_strong
 * @param {Array<{ id: string, value: number }>} ratios
 * @returns {Array<{ id: string, label: string, value: number, message: string }>}
 */
function generateFlags(ratios) {
  const flags = [];
  const benchToSquat = ratios.find((r) => r.id === 'bench_to_squat');
  if (benchToSquat) {
    const v = benchToSquat.value;
    let id, message;
    if (v > 1.1) {
      id = 'bench_dominant';
      message = 'Bench dominant relative to squat — consider prioritising lower-body work.';
    } else if (v < 0.45) {
      id = 'bench_lagging';
      message = 'Bench lagging; likely to benefit from horizontal push and triceps work.';
    } else {
      id = 'typical_bench_squat';
      message = 'Bench : Squat within typical range.';
    }
    flags.push({ id, label: 'Bench : Squat', value: v, message });
  }

  const squatToDeadlift = ratios.find((r) => r.id === 'squat_to_deadlift');
  if (squatToDeadlift) {
    const v = squatToDeadlift.value;
    let id, message;
    if (v < 0.8) {
      id = 'deadlift_dominant';
      message = 'Deadlift dominant; may indicate prioritising posterior-chain accessories.';
    } else if (v > 1.0) {
      id = 'squat_dominant';
      message = 'Squat dominant relative to deadlift — consider deadlift volume.';
    } else {
      id = 'typical_squat_deadlift';
      message = 'Squat : Deadlift within typical range.';
    }
    flags.push({ id, label: 'Squat : Deadlift', value: v, message });
  }

  const pressToBench = ratios.find((r) => r.id === 'press_to_bench');
  if (pressToBench) {
    const v = pressToBench.value;
    let id, message;
    if (v < 0.35) {
      id = 'press_weak';
      message = 'Overhead weak; consider shoulder stability and pressing volume.';
    } else if (v > 0.45) {
      id = 'press_strong';
      message = 'Press strong relative to bench.';
    } else {
      id = 'typical_press_bench';
      message = 'Press : Bench within typical range.';
    }
    flags.push({ id, label: 'Press : Bench', value: v, message });
  }
  const squatToBench = ratios.find((r) => r.id === 'squat_to_bench');
  if (squatToBench) {
    const v = squatToBench.value;
    let id, message;
    if (v < 1.0) { id = 'squat_lagging_bench'; message = 'Squat lagging relative to bench — consider prioritising lower-body work.'; }
    else if (v > 1.5) { id = 'bench_lagging_squat'; message = 'Bench lagging relative to squat — consider horizontal push and triceps work.'; }
    else { id = 'typical_squat_bench'; message = 'Squat : Bench within typical range.'; }
    flags.push({ id, label: 'Squat : Bench', value: v, message });
  }
  const deadliftToBench = ratios.find((r) => r.id === 'deadlift_to_bench');
  if (deadliftToBench) {
    const v = deadliftToBench.value;
    let id, message;
    if (v < 1.3) { id = 'deadlift_lagging_bench'; message = 'Deadlift lagging relative to bench — increase posterior-chain volume (aim ~6–10 hard sets/week of hinge + hamstring work for 6 weeks).'; }
    else if (v > 1.7) { id = 'bench_lagging_deadlift'; message = 'Bench lagging relative to deadlift — consider horizontal push work.'; }
    else { id = 'typical_deadlift_bench'; message = 'Deadlift : Bench within typical range.'; }
    flags.push({ id, label: 'Deadlift : Bench', value: v, message });
  }
  const squatToPress = ratios.find((r) => r.id === 'squat_to_press');
  if (squatToPress) {
    const v = squatToPress.value;
    let id, message;
    if (v < 1.8) { id = 'squat_lagging_press'; message = 'Squat lagging relative to press — consider lower-body volume.'; }
    else if (v > 2.4) { id = 'press_lagging_squat'; message = 'Press lagging relative to squat — consider shoulder and pressing volume.'; }
    else { id = 'typical_squat_press'; message = 'Squat : Press within typical range.'; }
    flags.push({ id, label: 'Squat : Press', value: v, message });
  }
  const deadliftToPress = ratios.find((r) => r.id === 'deadlift_to_press');
  if (deadliftToPress) {
    const v = deadliftToPress.value;
    let id, message;
    if (v < 2.2) { id = 'deadlift_lagging_press'; message = 'Deadlift lagging relative to press — add posterior-chain work (aim ~6–10 hard sets/week hinges/hamstrings; or +2–4 sets/week if already doing it).'; }
    else if (v > 2.8) { id = 'press_lagging_deadlift'; message = 'Press lagging relative to deadlift — consider overhead pressing volume.'; }
    else { id = 'typical_deadlift_press'; message = 'Deadlift : Press within typical range.'; }
    flags.push({ id, label: 'Deadlift : Press', value: v, message });
  }
  return flags;
}

/**
 * Confidence: High = 4 lifts + experience + bodyweight; Medium = 2–3 lifts; Low = 1 lift or missing experience.
 * @param {Object} inputs - { lifts, bodyweight?, experience }
 * @returns {'High'|'Medium'|'Low'}
 */
function computeConfidence(inputs) {
  const count = inputs.computed_1rms?.length ?? (inputs.lifts || []).filter((l) =>
    (l.method === 'one_rm' && l.one_rm != null && l.one_rm > 0) ||
    (l.method === 'weight_reps' && l.weight != null && l.weight > 0 && l.reps != null && l.reps >= 1 && l.reps <= 20)
  ).length;
  if (count === 1 || !inputs.experience) return 'Low';
  if (count >= 2 && count <= 3) return 'Medium';
  if (count === 4 && inputs.bodyweight != null && inputs.experience) return 'High';
  return 'Medium';
}

/** Accessory mapping: priorities and injury fallbacks (RULES.md §5) */
const ACCESSORY_MAP = {
  bench_dominant: {
    priorities: [
      { name: 'Squat strength', setsReps: '3x5', cue: 'Focus on depth and hip drive.' },
      { name: 'Lower-body volume', setsReps: '3x8', cue: 'Tempo control.' },
      { name: 'Hip drive work', setsReps: '3x10', cue: 'Glute activation.' },
    ],
    fallback_if_knee_injury: [
      { name: 'Romanian deadlift', setsReps: '3x6', cue: 'Hinge pattern.' },
      { name: 'Glute bridge', setsReps: '3x8', cue: 'Squeeze at top.' },
    ],
  },
  deadlift_dominant: {
    priorities: [
      { name: 'RDL', setsReps: '3x6', cue: 'Hinge at hips, slight knee bend.' },
      { name: 'Glute bridge', setsReps: '3x8', cue: 'Squeeze glutes at top.' },
      { name: 'Hamstring curl', setsReps: '3x10', cue: 'Control the eccentric.' },
    ],
    fallback_if_lower_back_pain: [
      { name: 'Hip thrust', setsReps: '3x6', cue: 'Neutral spine.' },
      { name: 'Single-leg RDL light', setsReps: '3x8', cue: 'Balance and hinge.' },
    ],
  },
  bench_lagging: {
    priorities: [
      { name: 'Horizontal push volume', setsReps: '3x8', cue: 'Full ROM.' },
      { name: 'Close-grip bench', setsReps: '3x6', cue: 'Elbows tucked, triceps focus.' },
      { name: 'Triceps work', setsReps: '3x10', cue: 'Control descent.' },
    ],
  },
  press_weak: {
    priorities: [
      { name: 'Seated DB press', setsReps: '3x6', cue: 'Press up, don\'t sway.' },
      { name: 'Face pulls', setsReps: '3x12', cue: 'External rotation at end.' },
      { name: 'Lateral raises', setsReps: '3x10', cue: 'Lead with elbows.' },
    ],
  },
};

/**
 * Get accessories for primary flag. Uses injury_notes for fallbacks.
 * @param {Array} flags - Generated flags
 * @param {Object} opts - { injury_notes? }
 * @returns {Array<{ name, setsReps, cue }>}
 */
function getAccessoriesForFlags(flags, opts = {}) {
  const flagged = flags.filter((f) => !f.id.startsWith('typical_'));
  const primary = flagged[0];
  const notes = (opts.injury_notes || '').toLowerCase();
  if (!primary) {
    return ACCESSORY_MAP.deadlift_dominant.priorities;
  }
  const mapping = ACCESSORY_MAP[primary.id];
  if (!mapping) return ACCESSORY_MAP.deadlift_dominant.priorities;
  if (primary.id === 'bench_dominant' && notes.includes('knee')) {
    return mapping.fallback_if_knee_injury || mapping.priorities;
  }
  if (primary.id === 'deadlift_dominant' && notes.includes('back')) {
    return mapping.fallback_if_lower_back_pain || mapping.priorities;
  }
  return mapping.priorities;
}

/**
 * Validate consistency: diagnosis must be derived from flags. If mismatch, return error and block PDF.
 * Also returns hints: missing_lifts_banner, warmup_hint, squat_deadlift_parity_note.
 * @param {Object} inputs - Raw form inputs
 * @param {Object} outputs - Computed outputs (diagnosis, flags, lifts, etc.)
 * @returns {{ error?: string, hints?: { missing_lifts_banner?: string, warmup_hint?: string, squat_deadlift_parity_note?: string } }}
 */
function validateConsistency(inputs, outputs) {
  const { flags, one_line_diagnosis } = outputs;
  const hints = {};

  // <2 lifts: allow PDF but include banner
  const liftCount = (outputs.computed_1rms || []).length;
  if (liftCount < 2) {
    hints.missing_lifts_banner = 'Add more lifts to unlock ratio diagnostics.';
  }

  // reps>10 and weight<0.5*bodyweight: non-blocking hint
  const lifts = inputs.lifts || outputs.lifts || [];
  const bodyweight = inputs.bodyweight ?? outputs.bodyweight;
  if (bodyweight != null) {
    const suspicious = lifts.find(
      (l) =>
        l.method === 'weight_reps' &&
        l.reps > 10 &&
        l.weight != null &&
        l.weight < 0.5 * bodyweight
    );
    if (suspicious) {
      hints.warmup_hint = 'Check input — is this a warmup?';
    }
  }

  // squat_to_deadlift ≈ 1.00 (abs diff <= 0.02): explanatory line
  const squatToDeadlift = (outputs.ratios || []).find((r) => r.id === 'squat_to_deadlift');
  if (squatToDeadlift && Math.abs(squatToDeadlift.value - 1.0) <= 0.02) {
    hints.squat_deadlift_parity_note = 'Squat and Deadlift nearly equal — include movement quality/technical notes.';
  }

  // squat_to_deadlift > 1.00: ensure diagnosis recommends deadlift volume/technique; if not, add warning
  if (squatToDeadlift && squatToDeadlift.value > 1.0) {
    const diagnosisLower = (outputs.one_line_diagnosis || '').toLowerCase();
    const recommendsDeadlift = /deadlift|posterior|hinge|technique|volume/.test(diagnosisLower);
    if (!recommendsDeadlift) {
      hints.squat_dominant_diagnosis_warning = 'Squat dominant — consider recommending deadlift volume or technique work.';
    }
  }

  // Diagnosis must match flags — block if mismatch
  const diagnosisLower = (one_line_diagnosis || '').toLowerCase();
  const flagIds = new Set((flags || []).map((f) => f.id));

  const checks = [
    { ids: ['bench_dominant'], phrases: ['bench dominant', 'bench strong'] },
    { ids: ['bench_lagging', 'bench_lagging_squat', 'bench_lagging_deadlift'], phrases: ['bench lagging', 'bench weak'] },
    { ids: ['deadlift_dominant'], phrases: ['deadlift dominant', 'deadlift strong'] },
    { ids: ['squat_dominant'], phrases: ['squat dominant', 'squat strong'] },
    { ids: ['press_weak'], phrases: ['press weak', 'overhead weak'] },
    { ids: ['press_strong'], phrases: ['press strong', 'overhead strong'] },
    { ids: ['squat_lagging_bench', 'squat_lagging_press'], phrases: ['squat lagging'] },
    { ids: ['deadlift_lagging_bench', 'deadlift_lagging_press'], phrases: ['deadlift lagging'] },
    { ids: ['press_lagging_squat', 'press_lagging_deadlift'], phrases: ['press lagging'] },
  ];

  for (const { ids, phrases } of checks) {
    const diagnosisMentions = phrases.some((p) => diagnosisLower.includes(p));
    const hasFlag = ids.some((id) => flagIds.has(id));

    if (diagnosisMentions && !hasFlag) {
      return {
        error: `[validateConsistency] Diagnosis mentions "${ids[0]}" but no matching flag. Flags: ${[...flagIds].join(', ')}`,
      };
    }
    if (hasFlag && flags?.length > 0) {
      const primary = flags[0];
      if (ids.includes(primary.id) && !phrases.some((p) => diagnosisLower.includes(p))) {
        return {
          error: `[validateConsistency] Flag "${primary.id}" present but diagnosis does not mention it.`,
        };
      }
    }
  }

  return { hints };
}

/**
 * Validate units (no mixed units).
 * @param {Object} data - Report data
 * @returns {{ error?: string }}
 */
function validateUnits(data) {
  if (data.units !== 'kg' && data.units !== 'lb') {
    return { error: '[validateUnits] Invalid units. Must be kg or lb.' };
  }
  return {};
}

/**
 * Run full pre-generate validation. Call before rendering PDF.
 * @param {Object} data - Full report data (inputs + outputs)
 * @throws {Error} If validation fails (blocks PDF)
 */
function validateBeforeGenerate(data) {
  const unitsErr = validateUnits(data);
  if (unitsErr.error) throw new Error(unitsErr.error);

  const consistency = validateConsistency(data, data);
  if (consistency.error) throw new Error(consistency.error);
}

/**
 * Get validation hints for render (missing_lifts_banner, warmup_hint, squat_deadlift_parity_note).
 * Does not throw; returns hints to include in PDF.
 * @param {Object} data - Full report data
 * @returns {Object} hints
 */
function getValidationHints(data) {
  const result = validateConsistency(data, data);
  return result.hints || {};
}

export {
  compute1RM,
  computeRatios,
  generateFlags,
  computeConfidence,
  validateConsistency,
  validateUnits,
  validateBeforeGenerate,
  getValidationHints,
  getAccessoriesForFlags,
  ACCESSORY_MAP,
};
