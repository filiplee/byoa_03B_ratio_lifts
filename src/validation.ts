/**
 * Validation script — exports required by RULES.md §7:
 * compute1RM, computeRatios, generateFlags, computeConfidence, validateConsistency
 */

import type { DiagnosticResult, DiagnosticInputs } from './types'

// Re-export for validation script API (RULES.md §7)
export { compute1RM, computeRatios, generateFlags, computeConfidence } from './calculations'

/**
 * Validate that diagnosis text category matches numeric flags.
 * If mismatch, throws (developer error) — blocks PDF generation per RULES.md §6.
 */
export function validateConsistency(_inputs: DiagnosticInputs, outputs: DiagnosticResult): void {
  const { flags, oneLineDiagnosis } = outputs

  const diagnosisToFlagMap: Record<string, string[]> = {
    bench_dominant: ['bench_dominant'],
    bench_lagging: ['bench_lagging', 'bench_lagging_squat', 'bench_lagging_deadlift'],
    deadlift_dominant: ['deadlift_dominant'],
    squat_dominant: ['squat_dominant'],
    press_weak: ['press_weak'],
    press_strong: ['press_strong'],
    squat_lagging: ['squat_lagging_bench', 'squat_lagging_press'],
    deadlift_lagging: ['deadlift_lagging_bench', 'deadlift_lagging_press'],
    press_lagging: ['press_lagging_squat', 'press_lagging_deadlift'],
  }

  const flagIds = new Set<string>(flags.map((f) => f.id))
  const diagnosisLower = oneLineDiagnosis.toLowerCase()

  const keyPhrases: Record<string, string[]> = {
    bench_dominant: ['bench dominant', 'bench strong'],
    bench_lagging: ['bench lagging', 'bench weak'],
    deadlift_dominant: ['deadlift dominant', 'deadlift strong'],
    squat_dominant: ['squat dominant', 'squat strong'],
    press_weak: ['press weak', 'overhead weak'],
    press_strong: ['press strong', 'overhead strong'],
    squat_lagging: ['squat lagging'],
    deadlift_lagging: ['deadlift lagging'],
    press_lagging: ['press lagging'],
  }

  for (const [key, flagIdsForKey] of Object.entries(diagnosisToFlagMap)) {
    const phrases = keyPhrases[key]
    if (!phrases) continue

    const diagnosisMentions = phrases.some((p) => diagnosisLower.includes(p))
    const hasFlag = flagIdsForKey.some((f) => flagIds.has(f))

    if (diagnosisMentions && !hasFlag) {
      throw new Error(
        `[validateConsistency] Diagnosis mentions "${key}" but no matching flag. Flags: ${[...flagIds].join(', ')}`
      )
    }
    if (hasFlag && !diagnosisMentions && flags.length > 0) {
      // Only strict-check if we have a primary flag; "typical" may not mention the ratio
      const primaryFlag = flags[0]
      if (flagIdsForKey.includes(primaryFlag.id) && !phrases.some((p) => diagnosisLower.includes(p))) {
        throw new Error(
          `[validateConsistency] Flag "${primaryFlag.id}" present but diagnosis does not mention it.`
        )
      }
    }
  }
}
