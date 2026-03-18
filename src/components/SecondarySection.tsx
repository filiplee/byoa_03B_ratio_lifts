import { useState } from 'react'
import type { FormState, PrimaryGoal } from '../types'

const GOALS: PrimaryGoal[] = ['Strength', 'Hypertrophy', 'Power', 'Rehab']
const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbells', 'Kettlebell', 'Bands', 'Cable', 'Bodyweight']

interface SecondarySectionProps {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}

export function SecondarySection({ form, onChange }: SecondarySectionProps) {
  const [open, setOpen] = useState(true)

  const toggleEquipment = (item: string) => {
    const next = form.equipment.includes(item)
      ? form.equipment.filter((e) => e !== item)
      : [...form.equipment, item]
    onChange({ equipment: next })
  }

  return (
    <div className="rounded-none border border-[#2a2a2a] bg-[#1c1c1c]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-[#f5f2ec]"
      >
        <span>Primary goal, injury & equipment</span>
        <span className="text-[#555]">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-[#2a2a2a] px-5 pb-5 pt-3">
          <p className="mb-3 text-xs text-[#a8a8a8]">
            Your goal affects the ideal ratios and accessory recommendations.
          </p>
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-[#a8a8a8]">Primary goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChange({ primary_goal: g })}
                  className={`rounded-none px-3 py-2 text-sm font-medium ${form.primary_goal === g ? 'bg-[#e8c547] text-[#0a0a0a]' : 'bg-[#111111] text-[#a8a8a8] border border-[#2a2a2a] hover:bg-[#2e2e2e]'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.injury}
                onChange={(e) => onChange({ injury: e.target.checked })}
                className="rounded-none border-[#2a2a2a] bg-[#111111] text-[#e8c547] focus:ring-[#e8c547]/50"
              />
              <span className="text-sm text-[#a8a8a8]">I have an injury or limitation</span>
            </label>
            {form.injury && (
              <input
                type="text"
                placeholder="Brief description (optional)"
                value={form.injury_notes ?? ''}
                onChange={(e) => onChange({ injury_notes: e.target.value || undefined })}
                className="mt-2 w-full rounded-none border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm font-light text-[#f5f2ec] placeholder:text-[#555] focus:border-[#e8c547] focus:outline-none focus:ring-2 focus:ring-[#e8c547]/30"
              />
            )}
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-[#a8a8a8]">Equipment available</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((e) => (
                <label key={e} className="flex items-center gap-1.5 rounded-none bg-[#111111] border border-[#2a2a2a] px-3 py-2 text-sm text-[#a8a8a8]">
                  <input
                    type="checkbox"
                    checked={form.equipment.includes(e)}
                    onChange={() => toggleEquipment(e)}
                    className="rounded-none border-[#2a2a2a] bg-[#111111] text-[#e8c547] focus:ring-[#e8c547]/50"
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
