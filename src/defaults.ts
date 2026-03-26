import type { FormState, LiftInput } from './types'
import { LIFT_IDS, LIFT_NAMES } from './types'

export function defaultLifts(): LiftInput[] {
  return LIFT_IDS.map((id) => ({
    id,
    name: LIFT_NAMES[id],
    method: 'weight_reps' as const,
    weight: undefined,
    reps: undefined,
    one_rm: undefined,
  }))
}

export const defaultFormState: FormState = {
  units: 'kg',
  bodyweight: undefined,
  gender: 'prefer_not_to_say',
  experience: null,
  lifts: defaultLifts(),
  primary_goal: 'Strength',
  injury: false,
  injury_notes: undefined,
}
